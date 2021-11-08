import * as R from "rambda";
import { cassandraClient } from "../database/cassandra";
import { toLong } from "../database/utils";
import { types as CassandraTypes } from "cassandra-driver";
import { TxSearchResult } from "./resolver-types";
import { QueryTransactionsArgs as QueryTransactionsArguments } from "./types.graphql";
import { toB64url } from "../query/transaction";
import { KEYSPACE } from "../constants";

const filtersToTable: { [direction: string]: Record<string, string> } = {
  HEIGHT_ASC: {
    bundledIn_dataRoots_ids_owners_target:
      "tx_gql_by_tx_id_owner_target_bundled_in_data_root_asc",
    bundledIn_dataRoots_owners_target:
      "tx_gql_by_owner_target_bundled_in_data_root_asc",
    bundledIn_dataRoots_ids_target:
      "tx_gql_by_tx_id_target_bundled_in_data_root_asc",
    bundledIn_dataRoots_ids_owners:
      "tx_gql_by_tx_id_owner_bundled_in_data_root_asc",
    dataRoots_ids_owners_target: "tx_gql_by_tx_id_owner_target_data_root_asc",
    bundledIn_ids_owners_target: "tx_gql_by_tx_id_owner_target_bundled_in_asc",
    bundledIn_dataRoots_target: "tx_gql_by_target_bundled_in_data_root_asc",
    bundledIn_dataRoots_owners: "tx_gql_by_owner_bundled_in_data_root_asc",
    dataRoots_owners_target: "tx_gql_by_owner_target_data_root_asc",
    bundledIn_owners_target: "tx_gql_by_owner_target_bundled_in_asc",
    bundledIn_dataRoots_ids: "tx_gql_by_tx_id_bundled_in_data_root_asc",
    dataRoots_ids_target: "tx_gql_by_tx_id_target_data_root_asc",
    bundledIn_ids_target: "tx_gql_by_tx_id_target_bundled_in_asc",
    dataRoots_ids_owners: "tx_gql_by_tx_id_owner_data_root_asc",
    bundledIn_ids_owners: "tx_gql_by_tx_id_owner_bundled_in_asc",
    ids_owners_target: "tx_gql_by_tx_id_owner_target_asc",
    bundledIn_dataRoots: "tx_gql_by_bundled_in_data_root_asc",
    dataRoots_target: "tx_gql_by_target_data_root_asc",
    bundledId_target: "tx_gql_by_target_bundled_in_asc",
    dataRoots_owners: "tx_gql_by_owner_data_root_asc",
    bundledId_owners: "tx_gql_by_owner_bundled_in_asc",
    owners_target: "tx_gql_by_owner_target_asc",
    dataRoots_ids: "tx_gql_by_tx_id_data_root_asc",
    bundledId_ids: "tx_gql_by_tx_id_bundled_in_asc",
    ids_target: "tx_gql_by_tx_id_target_asc",
    ids_owners: "tx_gql_by_tx_id_owner_asc",
    dataRoots: "tx_gql_by_data_root_asc",
    bundledIn: "tx_gql_by_bundled_in_asc",
    target: "tx_gql_by_target_asc",
    owners: "tx_gql_by_owner_asc",
  },
  HEIGHT_DESC: {
    bundledIn_dataRoots_ids_owners_target:
      "tx_gql_by_tx_id_owner_target_bundled_in_data_root_desc",
    bundledIn_dataRoots_owners_target:
      "tx_gql_by_owner_target_bundled_in_data_root_desc",
    bundledIn_dataRoots_ids_target:
      "tx_gql_by_tx_id_target_bundled_in_data_root_desc",
    bundledIn_dataRoots_ids_owners:
      "tx_gql_by_tx_id_owner_bundled_in_data_root_desc",
    dataRoots_ids_owners_target: "tx_gql_by_tx_id_owner_target_data_root_desc",
    bundledIn_ids_owners_target: "tx_gql_by_tx_id_owner_target_bundled_in_desc",
    bundledIn_dataRoots_target: "tx_gql_by_target_bundled_in_data_root_desc",
    bundledIn_dataRoots_owners: "tx_gql_by_owner_bundled_in_data_root_desc",
    dataRoots_owners_target: "tx_gql_by_owner_target_data_root_desc",
    bundledIn_owners_target: "tx_gql_by_owner_target_bundled_in_desc",
    bundledIn_dataRoots_ids: "tx_gql_by_tx_id_bundled_in_data_root_desc",
    dataRoots_ids_target: "tx_gql_by_tx_id_target_data_root_desc",
    bundledIn_ids_target: "tx_gql_by_tx_id_target_bundled_in_desc",
    dataRoots_ids_owners: "tx_gql_by_tx_id_owner_data_root_desc",
    bundledIn_ids_owners: "tx_gql_by_tx_id_owner_bundled_in_desc",
    ids_owners_target: "tx_gql_by_tx_id_owner_target_desc",
    bundledIn_dataRoots: "tx_gql_by_bundled_in_data_root_desc",
    dataRoots_target: "tx_gql_by_target_data_root_desc",
    bundledId_target: "tx_gql_by_target_bundled_in_desc",
    dataRoots_owners: "tx_gql_by_owner_data_root_desc",
    bundledId_owners: "tx_gql_by_owner_bundled_in_desc",
    owners_target: "tx_gql_by_owner_target_desc",
    dataRoots_ids: "tx_gql_by_tx_id_data_root_desc",
    bundledId_ids: "tx_gql_by_tx_id_bundled_in_desc",
    ids_target: "tx_gql_by_tx_id_target_desc",
    ids_owners: "tx_gql_by_tx_id_owner_desc",
    dataRoots: "tx_gql_by_data_root_desc",
    bundledIn: "tx_gql_by_bundled_in_desc",
    target: "tx_gql_by_target_desc",
    owners: "tx_gql_by_owner_desc",
  },
};

const buildTxFilterKey = (
  queryParameters: QueryTransactionsArguments
): string[] => {
  const filters = [];
  for (const parameter of Object.keys(queryParameters)) {
    if (
      ["ids", "recipients", "owners", "dataRoots", "bundledIn"].includes(
        parameter
      ) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !R.isEmpty<any>(
        queryParameters[parameter as keyof QueryTransactionsArguments]
      )
    ) {
      if (parameter === "recipients") {
        filters.push("target");
      } else {
        filters.push(parameter);
      }
    }
  }
  return filters;
};

interface TxFilterCursor {
  cursorType?: string;
  txIndex: string;
  dataItemIndex: string;
  sortOrder: string;
  nthBucket: number;
}

function encodeCursor({
  sortOrder,
  txIndex,
  dataItemIndex,
  nthBucket,
}: TxFilterCursor): string {
  const string = JSON.stringify([
    "tx_search",
    sortOrder,
    txIndex,
    dataItemIndex,
    nthBucket,
  ]);
  return Buffer.from(string).toString("base64url");
}

function parseTxFilterCursor(cursor: string): TxFilterCursor {
  try {
    const [cursorType, sortOrder, txIndex, dataItemIndex, nthBucket] =
      JSON.parse(Buffer.from(cursor, "base64url").toString()) as [
        string,
        string,
        string,
        string,
        number
      ];
    return { cursorType, sortOrder, txIndex, dataItemIndex, nthBucket };
  } catch {
    throw new Error("invalid cursor");
  }
}

function optimizeBucketSearch({
  isBucketSearchTag,
  isBucketSearchTx,
  buckets,
  nthBucket,
  resultCount,
}: {
  isBucketSearchTag: boolean;
  isBucketSearchTx: boolean;
  buckets: number[];
  nthBucket: number;
  resultCount: number;
}): number {
  const bucketsLeft = buckets.length - nthBucket;
  const thisBlockHeight = toLong(buckets[nthBucket])
    .mul(isBucketSearchTag ? 1e5 : 1e6)
    .divide(1000);

  if (thisBlockHeight.lt(5e5)) {
    return Math.min(
      bucketsLeft,
      isBucketSearchTx
        ? resultCount > 0
          ? 20
          : 200
        : resultCount > 0
        ? 200
        : 2000
    );
  } else if (thisBlockHeight.lt(6e5)) {
    return Math.min(
      bucketsLeft,
      isBucketSearchTx
        ? resultCount > 0
          ? 10
          : 50
        : resultCount > 0
        ? 100
        : 500
    );
  } else if (thisBlockHeight.lt(7e5)) {
    return Math.min(
      bucketsLeft,
      isBucketSearchTx ? (resultCount > 0 ? 5 : 40) : resultCount > 0 ? 50 : 400
    );
  } else {
    return Math.min(
      bucketsLeft,
      isBucketSearchTx ? (resultCount > 0 ? 1 : 30) : resultCount > 0 ? 2 : 300
    );
  }
}

export const findTxIDsFromTxFilters = async (
  maxHeightBlock: CassandraTypes.Long,
  queryParameters: QueryTransactionsArguments
): Promise<[TxSearchResult[], boolean]> => {
  const txFilterKeys = buildTxFilterKey(queryParameters);
  const tableKey = txFilterKeys.sort().join("_");

  const sortOrder =
    queryParameters.sort === "HEIGHT_ASC" ? "HEIGHT_ASC" : "HEIGHT_DESC";
  const isBucketSearchTag = Boolean(
    R.isEmpty(txFilterKeys) && !R.isEmpty(queryParameters.tags)
  );
  const isBucketSearchTx = Boolean(
    R.isEmpty(txFilterKeys) && R.isEmpty(queryParameters.tags)
  );

  const table = isBucketSearchTag
    ? sortOrder === "HEIGHT_ASC"
      ? "tx_gql_tags_asc"
      : "tx_gql_tags_desc"
    : isBucketSearchTx
    ? sortOrder === "HEIGHT_ASC"
      ? "txs_sorted_asc"
      : "txs_sorted_desc"
    : filtersToTable[sortOrder][tableKey];

  const cursorQuery =
    queryParameters.after &&
    typeof queryParameters.after === "string" &&
    !R.isEmpty(queryParameters.after);

  const maybeCursor = cursorQuery
    ? parseTxFilterCursor(queryParameters.after)
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({} as any);

  if (maybeCursor.cursorType && maybeCursor.cursorType !== "tx_search") {
    throw new Error(
      `invalid cursor: expected cursor of type tx_search but got ${maybeCursor.cursorType}`
    );
  }

  if (maybeCursor.sortOrder && maybeCursor.sortOrder !== sortOrder) {
    throw new Error(
      `invalid cursor: expected sortOrder ${sortOrder} but got cursor of ${maybeCursor.sortOrder}`
    );
  }

  const txsMinHeight_ =
    typeof queryParameters.block === "object" &&
    typeof queryParameters.block.min === "number"
      ? queryParameters.block.min * 1000
      : 0;

  const txsMinHeight =
    typeof maybeCursor.txIndex !== "undefined" &&
    sortOrder === "HEIGHT_ASC" &&
    toLong(maybeCursor.txIndex).gt(toLong(txsMinHeight_))
      ? maybeCursor.txIndex
      : txsMinHeight_;

  const txsMaxHeight_ =
    typeof queryParameters.block === "object" &&
    typeof queryParameters.block.max === "number"
      ? queryParameters.block.max * 1000
      : maxHeightBlock.add(1).mul(1000).toString();

  const txsMaxHeight =
    typeof maybeCursor.txIndex !== "undefined" && sortOrder === "HEIGHT_DESC"
      ? maybeCursor.txIndex
      : txsMaxHeight_;

  if (queryParameters.first === 0) {
    return [[], false];
  }

  const limit = Math.min(100, queryParameters.first || 10);

  let tagPairs: string[] = [];

  let allowFiltering = false;

  if (queryParameters.tags && !R.isEmpty(queryParameters.tags)) {
    allowFiltering = true;
    tagPairs = queryParameters.tags.reduce((accumulator, tagPairs) => {
      const tagName = toB64url(tagPairs.name || "");
      for (const tagValue of tagPairs.values) {
        accumulator.push(`'${tagName}|${toB64url(tagValue)}'`);
      }
      return accumulator;
    }, []);
  }

  const txFilterKeys_ = R.isEmpty(tagPairs)
    ? txFilterKeys
    : R.append("tags", txFilterKeys);

  const whereClause =
    isBucketSearchTag || isBucketSearchTx
      ? ""
      : txFilterKeys_.reduce((accumulator, key) => {
          const k_ =
            key === "target"
              ? "recipients"
              : (key as keyof QueryTransactionsArguments);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const whereVals: any = queryParameters[k_];
          const cqlKey = R.propOr(
            key,
            key
          )({
            ids: "tx_id",
            recipients: "target",
            owners: "owner",
            dataRoots: "data_root",
            bundledIn: "bundled_in",
            tags: "tag_pairs",
          });

          if (cqlKey === "tag_pairs") {
            const whereValsString = tagPairs
              .map((tp) => `AND tag_pairs CONTAINS ${tp}`)
              .join(" ");
            return `${accumulator} ${whereValsString}`;
          } else {
            const whereValsString =
              whereVals.length === 1
                ? ` = '${whereVals[0]}'`
                : `IN (${whereVals.map((wv: string) => `'${wv}'`).join(",")})`;

            return `${accumulator} AND ${cqlKey} ${whereValsString}`;
          }
        }, "");

  let hasNextPage = false;
  let txsFilterRows = [];

  if (!isBucketSearchTag && !isBucketSearchTx) {
    const txFilterQ = await cassandraClient.execute(
      `SELECT tx_id, tx_index, data_item_index FROM ${KEYSPACE}.${table} WHERE tx_index <= ${txsMaxHeight} AND tx_index >= ${txsMinHeight} ${whereClause} LIMIT ${
        limit + 1
      } ${allowFiltering ? "ALLOW FILTERING" : ""}`
    );

    txsFilterRows = txFilterQ.rows;
    hasNextPage = txFilterQ.rows.length > limit;
  } else {
    const xBuckets = toLong(txsMaxHeight)
      .div(isBucketSearchTag ? 1e5 : 1e6)
      .add(1);

    const rangePostFunction =
      sortOrder === "HEIGHT_ASC" ? R.identity : R.reverse;

    const bucketStart =
      typeof maybeCursor.nthBucket !== "undefined" &&
      maybeCursor.nthBucket !== -1 &&
      sortOrder === "HEIGHT_ASC"
        ? maybeCursor.nthBucket
        : toLong(txsMinHeight)
            .div(isBucketSearchTag ? 1e5 : 1e6)
            .toInt();

    const bucketEnd =
      typeof maybeCursor.nthBucket !== "undefined" &&
      maybeCursor.nthBucket !== -1 &&
      sortOrder === "HEIGHT_DESC"
        ? maybeCursor.nthBucket + 1
        : (xBuckets.add(1).toInt() as number);

    const buckets: number[] = rangePostFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (R.range as any)(bucketStart, bucketEnd)
    );

    let resultCount = 0;
    let nthBucket = 0;
    let requestCount = 0;

    while (nthBucket < buckets.length && resultCount < limit) {
      if (requestCount > 100) {
        throw new Error("Query timeout: please use more specific queries!");
      }

      const bucketsInThisRequest = optimizeBucketSearch({
        isBucketSearchTag,
        isBucketSearchTx,
        resultCount,
        buckets,
        nthBucket,
      });

      const bucketQuery = `AND ${
        isBucketSearchTag ? "nth_100k" : "nth_million"
      } IN (${buckets
        .slice(nthBucket, nthBucket + bucketsInThisRequest)
        .map((bucket: number) => `${bucket}`)
        .join(",")}) `;

      const whereQuery = isBucketSearchTag
        ? tagPairs.map((tp) => `AND tag_pairs CONTAINS ${tp}`).join(" ")
        : "";

      const nextResult = await cassandraClient.execute(
        `SELECT tx_id, tx_index, data_item_index FROM ${KEYSPACE}.${table} WHERE tx_index <= ${txsMaxHeight} AND tx_index >= ${txsMinHeight} ${bucketQuery} ${whereQuery} LIMIT ${
          limit - resultCount + 1
        } ${isBucketSearchTag ? "ALLOW FILTERING" : ""}`,
        { prepare: true }
      );
      for (const row of nextResult.rows) {
        !hasNextPage &&
          txsFilterRows.push(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (R.assoc as any)("nthBucket", buckets[nthBucket], row)
          );
        if (resultCount !== limit) {
          resultCount += 1;
        } else {
          hasNextPage = true;
        }
      }

      nthBucket += bucketsInThisRequest;
      requestCount += 1;
    }
  }

  const cursors = txsFilterRows.slice(1, limit + 1).map((row) =>
    encodeCursor({
      sortOrder,
      txIndex: row.tx_index.toString(),
      dataItemIndex: row.data_item_index.toString(),
      nthBucket: R.isEmpty(txFilterKeys_) ? row.nthBucket : -1,
    })
  );

  const txSearchResult = txsFilterRows.slice(0, limit).map((row, index) => ({
    txId: row.tx_id,
    cursor: index < cursors.length ? cursors[index] : undefined,
  }));

  return [txSearchResult, hasNextPage];
};
