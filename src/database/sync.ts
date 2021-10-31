import * as R from "rambda";
import pWaitFor from "p-wait-for";
import pMinDelay from "p-min-delay";
import pWhilst from "p-whilst";
import exitHook from "exit-hook";
import Fluture, { fork, parallel } from "fluture/index.js";
import Gauge from "gauge";
import GaugeThemes from "gauge/themes";
import { config } from "dotenv";
import { types as CassandraTypes } from "cassandra-driver";
import {
  KEYSPACE,
  POLLTIME_DELAY_SECONDS,
  isGatewayNodeModeEnabled,
} from "../constants";
import * as CONST from "./constants";
import { fromB64Url, isValidUTF8, ownerToAddress } from "../utility/encoding";
import { log } from "../utility/log";
import mkdirp from "mkdirp";
import { WorkerPool } from "../gatsby-worker";
import { MessagesFromWorker } from "../workers/message-types";
import { getHashList, getNodeInfo } from "../query/node";
import { BlockType, fetchBlockByHash } from "../query/block";
import { UnsyncedBlock } from "../types/cassandra";
import {
  cassandraClient,
  getMaxHeightBlock,
  hasManifestContentType,
  toLong,
} from "./cassandra";
import {
  blockMapper,
  blockHeightToHashMapper,
  blockGqlAscMapper,
  blockGqlDescMapper,
  manifestMapper,
  manifestUnimportedMapper,
  permawebPathMapper,
  statusMapper,
  transactionMapper,
  txGqlAscMapper,
  txGqlDescMapper,
  txOffsetMapper,
} from "./mapper";
import { DropTagQueryParameters, dropTagQuery } from "./tags-mapper";
import * as Dr from "./doctor";

let gauge_: any;
let session_: any;

const PARALLEL_WORKERS = Number.isNaN(process.env["PARALLEL_WORKERS"])
  ? 1
  : Number.parseInt(process.env["PARALLEL_WORKERS"] || "1");

process.env.NODE_ENV !== "test" && config();
mkdirp.sync("cache");

interface WorkerReadyWait {
  [index: string]: {
    promise: Promise<void>;
    resolve: () => void;
  };
}

const workerReadyPromises: WorkerReadyWait = R.range(
  1,
  PARALLEL_WORKERS + 1
).reduce((accumulator, index) => {
  let resolve: (_: unknown) => void;
  const promise = new Promise<void>((resolve_: () => void) => {
    resolve = resolve_;
  });
  accumulator[index] = { promise, resolve };
  return accumulator;
}, {} as Record<string, { promise: Promise<unknown>; resolve: (_: unknown) => unknown }>) as WorkerReadyWait;

const workerPool = new WorkerPool<typeof import("../workers/main")>(
  process.cwd() + "/src/workers/main",
  {
    numWorkers: PARALLEL_WORKERS,
    logFilter: (data) =>
      !/ExperimentalWarning:/.test(data) && !/node --trace-warnings/.test(data),
    env: R.mergeAll([
      {
        PWD: process.cwd(),
        TS_NODE_FILES: true,
        NODE_PATH: process.cwd() + "/node_modules",
        NODE_OPTIONS: `--require ${
          process.cwd() + "/node_modules/ts-node/register"
        }`,
      },
      {},
    ]),
  }
);

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const messagePromiseReceivers: Record<string, any> = {};

export const txInFlight: Record<string, number> = {};

const numberOr0 = (n: number | undefined): number => (Number.isNaN(n) ? 0 : n);

export const getTxsInFlight = (): number =>
  Object.values(txInFlight).reduce((a, b) => numberOr0(a) + numberOr0(b));

function onWorkerMessage(message: MessagesFromWorker, workerId: number): void {
  switch (message.type) {
    case "worker:ready": {
      workerReadyPromises[workerId].resolve();
      break;
    }
    case "log:info": {
      log.info(`${message.message}`);
      break;
    }
    case "log:warn": {
      log.info(`${message.message}`);
      break;
    }
    case "log:error": {
      log.info(`${message.message}`);
      break;
    }
    case "block:new": {
      if (typeof messagePromiseReceivers[workerId] === "function") {
        messagePromiseReceivers[workerId](message.payload);
        delete messagePromiseReceivers[workerId];
        delete txInFlight[`${workerId}`];
      }
      break;
    }
    case "stats:tx:flight": {
      txInFlight[`${workerId}`] =
        typeof message.payload === "number"
          ? message.payload
          : Number.parseInt(message.payload);
      gauge_ &&
        gauge_.show(
          `blocks: ${currentHeight}/${topHeight}\t tx: ${getTxsInFlight()}`
        );
      break;
    }
    default: {
      console.error("unknown worker message arrived", message);
    }
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
(workerPool.onMessage as any)(onWorkerMessage);

const trackerTheme = GaugeThemes.newTheme(
  GaugeThemes({
    hasUnicode: false,
    hasColor: true,
  })
);

export let topHash = "";
export let gatewayHeight: CassandraTypes.Long = toLong(0);
export let topHeight = 0;
export let currentHeight = 0;

// export let topTxIndex: CassandraTypes.Long = toLong(0);

const developmentSyncLength: number | undefined =
  !process.env["DEVELOPMENT_SYNC_LENGTH"] ||
  R.isEmpty(process.env["DEVELOPMENT_SYNC_LENGTH"])
    ? undefined
    : Number.parseInt(process.env["DEVELOPMENT_SYNC_LENGTH"] as string);

// eslint-disable-next-line use-isnan
if (developmentSyncLength === Number.NaN) {
  console.error("Development sync range variable produced, illegal value NaN");
  process.exit(1);
}

let isPollingStarted = false;
// let isImportCacheGcRunning = true; // true because we want to wait before starting periodic gc runs
let isPaused = false;

// export function togglePause(): void {
//   isPaused = !isPaused;
// }

async function resolveFork(previousBlock: BlockType): Promise<void> {
  isPaused = true;
  const pprevBlock = await fetchBlockByHash(previousBlock.previous_block);

  const blockQueryResult = await cassandraClient.execute(
    `SELECT height FROM ${KEYSPACE}.block WHERE indep_hash=?`,
    [pprevBlock.indep_hash]
  );

  if (blockQueryResult.rowLength > 0) {
    log.info("fork diverges at " + blockQueryResult.rows[0].height.toString());
    if (getTxsInFlight() > 0) {
      log.info(
        "waiting for " + getTxsInFlight() + " txs in flight to settle..."
      );
      await pWaitFor(() => getTxsInFlight() === 0, { interval: 200 });
    }
    const result = await cassandraClient.execute(
      `SELECT block_height,block_hash
       FROM ${KEYSPACE}.block_height_by_block_hash
       WHERE block_height > ${blockQueryResult.rows[0].height.toString()}
       ALLOW FILTERING`,
      [],
      { prepare: true }
    );

    for await (const block of result) {
      log.info(
        `[fork recovery] removing data from abandoned block: ${block.block_hash} at height ${block.block_height}`
      );
      const abandonedBlock = await blockMapper.get({
        indep_hash: block.block_hash,
      });
      await blockMapper.remove({ indep_hash: block.block_hash });
      await blockHeightToHashMapper.remove({
        block_height: block.block_height,
      });

      // BlockGqlAsc
      const txGqlBlockAscPartitionId = CONST.getGqlBlockHeightAscPartitionName(
        block.block_height
      );
      const txGqlBlockAscBucketName = CONST.getGqlBlockHeightAscBucketName(
        block.block_height
      );
      const txGqlBlockAscBucketNumber = CONST.getGqlBlockHeightAscBucketNumber(
        block.block_height
      );

      try {
        await blockGqlAscMapper.remove({
          partition_id: txGqlBlockAscPartitionId,
          bucket_id: txGqlBlockAscBucketName,
          bucket_number: txGqlBlockAscBucketNumber,
          height: block.block_height,
        });
      } catch {}

      // BlockGqlDesc
      const txGqlBlockDescPartitionId =
        CONST.getGqlBlockHeightDescPartitionName(block.block_height);
      const txGqlBlockDescBucketName = CONST.getGqlBlockHeightDescBucketName(
        block.block_height
      );
      const txGqlBlockDescBucketNumber =
        CONST.getGqlBlockHeightDescBucketNumber(block.block_height);

      try {
        await blockGqlDescMapper.remove({
          partition_id: txGqlBlockDescPartitionId,
          bucket_id: txGqlBlockDescBucketName,
          bucket_number: txGqlBlockDescBucketNumber,
          height: block.block_height,
        });
      } catch {}

      if (!R.isEmpty(abandonedBlock.txs)) {
        for (const abandonedTx of abandonedBlock.txs) {
          const txGqlAscPart = CONST.getGqlTxIdAscPartitionName(
            block.block_height
          );
          const txGqlAscBucketId = CONST.getGqlTxIdAscBucketName(
            block.block_height
          );
          const txGqlAscBucketNumber = CONST.getGqlTxIdAscBucketNumber(
            block.block_height
          );
          try {
            await txGqlAscMapper.remove({
              tx_index: abandonedTx.tx_index,
              partition_id: txGqlAscPart,
              bucket_id: txGqlAscBucketId,
              bucket_number: txGqlAscBucketNumber,
            });
          } catch {}

          const txGqlDescPart = CONST.getGqlTxIdDescPartitionName(
            block.block_height
          );
          const txGqlDescBucketId = CONST.getGqlTxIdDescBucketName(
            block.block_height
          );
          const txGqlDescBucketNumber = CONST.getGqlTxIdDescBucketNumber(
            block.block_height
          );

          try {
            await txGqlDescMapper.remove({
              tx_index: abandonedTx.tx_index,
              partition_id: txGqlDescPart,
              bucket_id: txGqlDescBucketId,
              bucket_number: txGqlDescBucketNumber,
            });
          } catch {}

          try {
            await txOffsetMapper.remove({ tx_id: abandonedTx.tx_id });
          } catch {}

          if (
            abandonedTx.tags &&
            Array.isArray(abandonedTx.tags) &&
            !R.isEmpty(abandonedTx.tags)
          ) {
            const abandonedTxTags = abandonedTx.tag.map(
              (t: CassandraTypes.Tuple) => t.values
            );
            const isManifest = hasManifestContentType(abandonedTxTags);
            let index = 0;

            for (const abandonedTag of abandonedTxTags) {
              const [tagName, tagValue] = abandonedTag;

              const owner = ownerToAddress(abandonedTx.owner);
              const tagDropParameters: DropTagQueryParameters = {
                tagName,
                tagValue,
                owner,
                bundledIn: abandonedTx.bundled_in,
                dataItemIndex: "0",
                dataRoot: abandonedTx.data_root,
                tagIndex: `${index}`,
                target: abandonedTx.target,
                txId: abandonedTx.tx_id,
                txIndex: abandonedTx.tx_id,
              };
              await dropTagQuery(tagDropParameters);
              index += 1;
            }
            if (isManifest) {
              const maybeManifest = await manifestMapper.get({
                tx_id: abandonedTx.tx_id,
              });

              if (maybeManifest) {
                const manifestPaths = JSON.parse(maybeManifest.manifest_paths);
                const manifestFiles = Object.keys(manifestPaths);

                if (manifestFiles.includes(maybeManifest.manifest_index)) {
                  try {
                    await permawebPathMapper.remove({
                      domain_id: abandonedTx.tx_id,
                      uri_path: "",
                    });
                  } catch {}
                }
                for (const manifestFile of manifestFiles) {
                  try {
                    await permawebPathMapper.remove({
                      domain_id: abandonedTx.tx_id,
                      uri_path: escape(manifestFile),
                    });
                  } catch {}
                }
              }
              try {
                await manifestUnimportedMapper.remove(
                  { tx_id: abandonedTx.tx_id },
                  { ifExists: true }
                );
              } catch {}
            }
          }
        }
      }
    }

    log.info(
      `[fork recovery] abandoned blocks removal done, re-importing missing blocks...`
    );

    const nodeInfo = await getNodeInfo({});

    for (const newForkHeight of R.range(
      blockQueryResult.rows[0].height.toInt() + 1,
      typeof nodeInfo.height === "number"
        ? nodeInfo.height
        : Number.parseInt(nodeInfo.height)
    )) {
      await workerPool.single.importBlock(newForkHeight);
    }

    log.info(`[fork recovery] all done!`);
  } else {
    return await resolveFork(pprevBlock);
  }
}

let poller: Promise<void>;
let exited = false;

exitHook(() => {
  exited = true;
});

const pollNewBlocks = async (): Promise<void> => {
  if (isPaused) return;
  if (!isPollingStarted && !poller) {
    isPollingStarted = true;
    poller = pWhilst(
      () => !exited,
      async () => {
        try {
          await (pMinDelay as any)(await pollNewBlocks(), 120 * 1000);
        } catch (error) {
          console.error(error);
        }
      }
    );
    // poller = setInterval(pollNewBlocks, POLLTIME_DELAY_SECONDS * 1000);
    log.info(
      "polling for new blocks every " + POLLTIME_DELAY_SECONDS + " seconds"
    );
  }

  const nodeInfo = await getNodeInfo({});

  if (!nodeInfo) {
    return;
  }

  topHeight = nodeInfo.height;

  [topHash, gatewayHeight] = await getMaxHeightBlock();

  statusMapper.update({
    session: session_.uuid,
    gateway_height: `${gatewayHeight}`,
    arweave_height: `${topHeight}`,
  });

  if (nodeInfo.current !== topHash) {
    const currentRemoteBlock = await fetchBlockByHash(nodeInfo.current);
    const previousBlock = await fetchBlockByHash(
      currentRemoteBlock.previous_block
    );

    // fork recovery
    if (previousBlock.indep_hash !== topHash) {
      log.info(
        "blocks out of sync with the remote node " +
          previousBlock.indep_hash +
          "!= " +
          topHash
      );
      await resolveFork(currentRemoteBlock);
      isPaused = false;
      log.info("blocks are back in sync!");
    } else {
      await workerPool.single.importBlock(nodeInfo.height);
    }
  }
};

async function detectFirstRun(): Promise<boolean> {
  const queryResponse = await cassandraClient.execute(
    `SELECT height
     FROM ${KEYSPACE}.block LIMIT 1`
  );
  return queryResponse && queryResponse.rowLength > 0 ? false : true;
}

async function findMissingBlocks(hashList: string[]): Promise<UnsyncedBlock[]> {
  const hashListObject = hashList.reduce((accumulator, hash, height) => {
    accumulator[height] = { height, hash };
    return accumulator;
  }, {} as Record<string, UnsyncedBlock>);

  log.info("[database] Looking for missing blocks...");
  const result = await cassandraClient.execute(
    `SELECT height, indep_hash, timestamp, txs
         FROM ${KEYSPACE}.block`,
    [],
    { prepare: true, executionProfile: "fast" }
  );

  for await (const rowResult of result) {
    const matchingRow = hashListObject[rowResult.height.toString()];

    if (
      matchingRow &&
      R.equals(matchingRow["hash"], rowResult.indep_hash) &&
      R.equals(matchingRow["height"], rowResult.height)
    ) {
      delete hashListObject[rowResult.height];
    } else {
      if (!matchingRow) {
        log.info(`Found missing block: ${rowResult.height}`);
      } else if (!R.equals(matchingRow["height"], rowResult.height)) {
        log.info(
          `Found mismatching block at: ${rowResult.height} because ${matchingRow["height"]} != ${rowResult.height}`
        );
      } else if (!R.equals(matchingRow["hash"], rowResult.indep_hash)) {
        log.info(
          `Found mismatching block at: ${rowResult.height} because ${matchingRow["hash"]} != ${rowResult.indep_hash}`
        );
      }
    }
  }
  return R.sortBy(R.prop("height"))(
    R.values(hashListObject) as UnsyncedBlock[]
  );
}

async function startGatewayNodeMode(): Promise<void> {
  // TODO: read stats from cassandra
  [topHash, gatewayHeight] = await getMaxHeightBlock();
}

async function startManifestImportWorker(): Promise<void> {
  try {
    await (pMinDelay as any)(workerPool.single.importManifests(), 120 * 1000);
  } catch (error) {
    console.error(error);
  }

  return await startManifestImportWorker();
}

export async function startSync({
  isTesting = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  session,
}: {
  session: { uuid: CassandraTypes.TimeUuid };
  isTesting?: boolean;
}): Promise<void> {
  session_ = session;

  if (isGatewayNodeModeEnabled) {
    log.info(
      "[sync] vartex gateway-node mode is enabled so no syncing will be performed (aka read-only mode)"
    );
    await startGatewayNodeMode();
    return;
  }

  // wait until worker threads are ready
  await Promise.all(R.map(R.prop("promise"))(R.values(workerReadyPromises)));

  const hashList: string[] = await getHashList({});
  topHeight = hashList.length;
  const firstRun = await detectFirstRun();
  let lastBlock: CassandraTypes.Long = toLong(-1);
  // let lastTx: CassandraTypes.Long = toLong(-1);

  if (!firstRun && !developmentSyncLength) {
    // await Dr.enqueueUnhandledCache(
    //   enqueueIncomingTxQueue,
    //   enqueueTxQueue,
    //   txImportCallback,
    //   incomingTxCallback,
    //   txQueue
    // );

    const isMaybeMissingBlocks = await Dr.checkForBlockGaps();

    if (isMaybeMissingBlocks) {
      const blockGap = await Dr.findBlockGaps();
      if (!R.isEmpty(blockGap)) {
        console.error("Repairing missing block(s):", blockGap);

        let doneSignalResolve: () => void;
        const doneSignal = new Promise<void>(function (resolve) {
          doneSignalResolve = resolve;
        });

        fork((error: unknown) => console.error(JSON.stringify(error)))(() => {
          doneSignalResolve();
          console.log("Block repair done!");
        })(
          parallel(PARALLEL_WORKERS)(
            blockGap.map((height) =>
              Fluture(function (
                reject: (message?: string) => void,
                fresolve: () => void
              ) {
                workerPool.single
                  .importBlock(height)
                  .then(fresolve)
                  .catch(reject);
                lastBlock = toLong(height);
                return () => {
                  console.error(`Fluture.Parallel crashed`);
                  process.exit(1);
                };
              })
            )
          )
        );
        await doneSignal;
      }
    }

    // await Dr.findTxGaps();
    try {
      const result_ = await getMaxHeightBlock();
      lastBlock = result_[1];
    } catch {
      // console.error(error);
    }
  }

  const gauge = new Gauge(process.stderr, {
    // tty: 79,
    template: [
      { type: "progressbar", length: 0 },
      { type: "activityIndicator", kerning: 1, length: 2 },
      { type: "section", kerning: 1, default: "" },
      { type: "subsection", kerning: 1, default: "" },
    ],
  });
  gauge.setTheme(trackerTheme);

  let unsyncedBlocks: UnsyncedBlock[] = firstRun
    ? hashList.map((hash, height) => ({ hash, height }))
    : await findMissingBlocks(hashList);

  const initialLastBlock = toLong(
    unsyncedBlocks[0] ? unsyncedBlocks[0].height : 0
  );

  if (developmentSyncLength) {
    unsyncedBlocks = R.slice(
      developmentSyncLength,
      unsyncedBlocks.length,
      unsyncedBlocks
    );

    // initialLastBlock = toLong(developmentSyncLength).sub(1);
    gatewayHeight = initialLastBlock;
    statusMapper.update({
      session: session.uuid,
      gateway_height: `${gatewayHeight}`,
    });
  } else {
    gatewayHeight = lastBlock;
    statusMapper.update({
      session: session.uuid,
      gateway_height: `${lastBlock}`,
    });
  }

  // blockQueueState.nextHeight = initialLastBlock.lt(1)
  //   ? toLong(1)
  //   : initialLastBlock;
  // txQueueState.nextTxIndex = initialLastBlock.mul(MAX_TX_PER_BLOCK);
  // isImportCacheGcRunning = false;

  // wait a minute until starting to poll for unimported manifest
  !process.env.OFFLOAD_MANIFEST_IMPORT &&
    setTimeout(startManifestImportWorker, 60 * 1000);

  if (firstRun) {
    log.info(
      "[sync] database seems to be empty, starting preperations for import..."
    );
  } else if (R.isEmpty(unsyncedBlocks)) {
    log.info("[sync] fully synced db");
    pollNewBlocks();
    return;
  } else {
    log.info(
      `[sync] missing ${unsyncedBlocks.length} blocks, starting sync...`
    );
  }
  // check health
  // if (!firstRun) {
  //   await Dr.fixNonLinearBlockOrder();
  // }

  gauge.enable();
  gauge_ = gauge;

  const currentImports = new Set();

  fork(function (reason: string | void) {
    console.error("Fatal", reason || "");
    process.exit(1);
  })(function () {
    log.info("Database fully in sync with block_list");
    !isPollingStarted && pollNewBlocks();
  })(
    parallel(PARALLEL_WORKERS)(
      unsyncedBlocks.map(({ height }: { height: number }) => {
        return Fluture(function (
          reject: (message?: string) => void,
          fresolve: () => void
        ) {
          const singleJob = workerPool.single; // you have 1 job!
          const blockPromise = singleJob.importBlock(height);
          currentImports.add(height);
          statusMapper.update({
            session: session.uuid,
            current_imports: [...currentImports].map((x) => `${x}`),
          });
          currentHeight = height;
          statusMapper.update({
            session: session.uuid,
            gateway_height: `${height}`,
          });
          blockPromise
            .then(() => {
              fresolve();
              currentImports.delete(height);
              statusMapper.update({
                session: session.uuid,
                status: "OK",
                gateway_height: `${currentHeight}`,
                arweave_height: `${topHeight}`,
                current_imports: [...currentImports].map((x) => `${x}`),
              });
              gauge.show(
                `blocks: ${currentHeight}/${topHeight}\t tx: ${getTxsInFlight()}`
              );
            })
            .catch(reject);

          return () => {
            console.error(
              "Fatal error while importing block at height",
              height
            );
          };
        });
      })
    )
  );
}
