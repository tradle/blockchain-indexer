#!/usr/bin/env node

const path = require('path')
const yargs = require('yargs')
const yn = require('yn')
const git = require('git-rev-sync')
const logger = require('../logger').create('cli')
const createComponents = require('../')
const { isAddressHash } = require('../utils')
const Errors = require('../errors')
const baseDir = path.resolve(process.cwd())
const conf = require('../conf').fromDir(baseDir)
const getByHash = async (hash) => {
  const { storage, api } = createComponents(conf, {
    api: true,
  })

  try {
    if (isAddressHash(hash)) {
      return await api.getAddress(hash)
    }

    return await api.getTransaction(hash)
  } finally {
    storage.close()
  }
}

logger.log('version', {
  semver: require('../../package.json').version,
  branch: git.branch(),
  commit: git.short(),
})

yargs
  .command({
    command: 'start',
    desc: 'start processing the blockchain / run REST server',
    builder: {
      server: {
        default: typeof conf.port === 'number'
      },
      indexer: {
        default: true
      },
    },
    handler: ({ server, indexer }) => require('./serve')
      .serve(conf, {
        server: yn(server),
        indexer: yn(indexer),
        logger,
      })
      .on('error', err => {
        logger.error(err.stack)
        process.exit(1)
      }),
  })
  .command({
    command: 'get <hash>',
    desc: 'get address or transaction by hash',
    handler: async ({ hash }) => {
      try {
        const result = await getByHash(hash)
        logger.logPretty(result)
      } catch (err) {
        logger.error(err.message)
        return
      }
    }
  })
  .command({
    command: 'dump',
    desc: 'print address->txs db state',
    handler: async () => {
      if (conf.storage === 'redis') {
        throw new Errors.InvalidInput('not supported for redis-based storage')
      }

      const { state } = createComponents(conf, { state: true })
      state.createReadStream().on('data', logger.logPretty)
    }
  })
  .argv

// process.on('unhandledRejection', (...args) => {
//   // eslint-disable-next-line no-console
//   console.error('unhandled rejection', JSON.stringify(args, null, 2))
//   // eslint-disable-next-line no-debugger
//   debugger
// })
