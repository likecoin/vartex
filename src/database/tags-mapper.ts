import { Client as CassandraClient, mapping } from "cassandra-driver";
import { KEYSPACE } from "../constants";

const { Mapper } = mapping;

export const tagModels = {
  Tag: [],
  TagAndTxId: ["tx_id"],
  TagAndOwner: ["owner"],
  TagAndTarget: ["target"],
  TagAndBundledIn: ["bundled_in"],
  TagAndDataRoot: ["data_root"],
  TagAndTxIdAndOwner: ["tx_id", "owner"],
  TagAndTxIdAndTarget: ["tx_id", "target"],
  TagAndTxIdAndBundledIn: ["tx_id", "bundled_in"],
  TagAndTxIdAndDataRoot: ["tx_id", "data_root"],
  TagAndOwnerAndTarget: ["owner", "target"],
  TagAndOwnerAndBundledIn: ["owner", "bundled_in"],
  TagAndOwnerAndDataRoot: ["owner", "data_root"],
  TagAndTargetAndBundledIn: ["target", "bundled_in"],
  TagAndTargetAndDataRoot: ["target", "data_root"],
  TagAndBundledInAndDataRoot: ["bundled_in", "data_root"],
  TagAndTxIdAndOwnerAndTarget: ["tx_id", "owner", "target"],
  TagAndTxIdAndOwnerAndBundledIn: ["tx_id", "owner", "bundled_in"],
  TagAndTxIdAndOwnerAndDataRoot: ["tx_id", "owner", "data_root"],
  TagAndTxIdAndTargetAndBundledIn: ["tx_id", "target", "bundled_in"],
  TagAndTxIdAndTargetAndDataRoot: ["tx_id", "target", "data_root"],
  TagAndTxIdAndBundledInAndDataRoot: ["tx_id", "bundled_in", "data_root"],
  TagAndOwnerAndTargetAndBundledIn: ["owner", "target", "bundled_in"],
  TagAndOwnerAndTargetAndDataRoot: ["owner", "target", "data_root"],
  TagAndOwnerAndBundledInAndDataRoot: ["owner", "bundled_in", "data_root"],
  TagAndTargetAndBundledInAndDataRoot: ["target", "bundled_in", "data_root"],
  TagAndTxIdAndOwnerAndTargetAndBundledIn: [
    "tx_id",
    "owner",
    "target",
    "bundled_in",
  ],
  TagAndTxIdAndOwnerAndTargetAndDataRoot: [
    "tx_id",
    "owner",
    "target",
    "data_root",
  ],
  TagAndTxIdAndOwnerAndBundledInAndDataRoot: [
    "tx_id",
    "owner",
    "bundled_in",
    "data_root",
  ],
  TagAndTxIdAndTargetAndBundledInAndDataRoot: [
    "tx_id",
    "target",
    "bundled_in",
    "data_root",
  ],
  TagAndOwnerAndTargetAndBundledInAndDataRoot: [
    "owner",
    "target",
    "bundled_in",
    "data_root",
  ],
  TagAndTxIdAndOwnerAndTargetAndBundledInAndDataRoot: [
    "tx_id",
    "owner",
    "target",
    "bundled_in",
    "data_root",
  ],
};

export const makeTagsMapper = (cassandraClient: CassandraClient): any =>
  new Mapper(cassandraClient, {
    models: {
      Tag: {
        keyspace: KEYSPACE,
        tables: ["tx_tag_gql_asc_migration_0", "tx_tag_gql_desc_migration_0"],
      },
      TagAndTxId: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_asc_migration_0",
          "tx_tag_gql_by_tx_id_desc_migration_0",
        ],
      },
      TagAndOwner: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_owner_asc_migration_0",
          "tx_tag_gql_by_owner_desc_migration_0",
        ],
      },
      TagAndTarget: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_target_asc_migration_0",
          "tx_tag_gql_by_target_desc_migration_0",
        ],
      },
      TagAndBundledIn: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_bundled_in_asc_migration_0",
          "tx_tag_gql_by_bundled_in_desc_migration_0",
        ],
      },
      TagAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_data_root_asc_migration_0",
          "tx_tag_gql_by_data_root_desc_migration_0",
        ],
      },
      TagAndTxIdAndOwner: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_owner_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_owner_desc_migration_0",
        ],
      },
      TagAndTxIdAndTarget: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_target_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_target_desc_migration_0",
        ],
      },
      TagAndTxIdAndBundledIn: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_bundled_in_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_bundled_in_desc_migration_0",
        ],
      },
      TagAndTxIdAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_data_root_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_data_root_desc_migration_0",
        ],
      },
      TagAndOwnerAndTarget: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_owner_and_target_asc_migration_0",
          "tx_tag_gql_by_owner_and_target_desc_migration_0",
        ],
      },
      TagAndOwnerAndBundledIn: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_owner_and_bundled_in_asc_migration_0",
          "tx_tag_gql_by_owner_and_bundled_in_desc_migration_0",
        ],
      },
      TagAndOwnerAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_owner_and_data_root_asc_migration_0",
          "tx_tag_gql_by_owner_and_data_root_desc_migration_0",
        ],
      },
      TagAndTargetAndBundledIn: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_target_and_bundled_in_asc_migration_0",
          "tx_tag_gql_by_target_and_bundled_in_desc_migration_0",
        ],
      },
      TagAndTargetAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_target_and_data_root_asc_migration_0",
          "tx_tag_gql_by_target_and_data_root_desc_migration_0",
        ],
      },
      TagAndBundledInAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_bundled_in_and_data_root_asc_migration_0",
          "tx_tag_gql_by_bundled_in_and_data_root_desc_migration_0",
        ],
      },
      TagAndTxIdAndOwnerAndTarget: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_owner_and_target_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_owner_and_target_desc_migration_0",
        ],
      },
      TagAndTxIdAndOwnerAndBundledIn: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_owner_and_bundled_in_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_owner_and_bundled_in_desc_migration_0",
        ],
      },
      TagAndTxIdAndOwnerAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_owner_and_data_root_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_owner_and_data_root_desc_migration_0",
        ],
      },
      TagAndTxIdAndTargetAndBundledIn: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_target_and_bundled_in_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_target_and_bundled_in_desc_migration_0",
        ],
      },
      TagAndTxIdAndTargetAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_target_and_data_root_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_target_and_data_root_desc_migration_0",
        ],
      },
      TagAndTxIdAndBundledInAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_bundled_in_and_data_root_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_bundled_in_and_data_root_desc_migration_0",
        ],
      },
      TagAndOwnerAndTargetAndBundledIn: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_owner_and_target_and_bundled_in_asc_migration_0",
          "tx_tag_gql_by_owner_and_target_and_bundled_in_desc_migration_0",
        ],
      },
      TagAndOwnerAndTargetAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_owner_and_target_and_data_root_asc_migration_0",
          "tx_tag_gql_by_owner_and_target_and_data_root_desc_migration_0",
        ],
      },
      TagAndOwnerAndBundledInAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_owner_and_bundled_in_and_data_root_asc_migration_0",
          "tx_tag_gql_by_owner_and_bundled_in_and_data_root_desc_migration_0",
        ],
      },
      TagAndTargetAndBundledInAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_target_and_bundled_in_and_data_root_asc_migration_0",
          "tx_tag_gql_by_target_and_bundled_in_and_data_root_desc_migration_0",
        ],
      },
      TagAndTxIdAndOwnerAndTargetAndBundledIn: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_owner_and_target_and_bundled_in_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_owner_and_target_and_bundled_in_desc_migration_0",
        ],
      },
      TagAndTxIdAndOwnerAndTargetAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_owner_and_target_and_data_root_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_owner_and_target_and_data_root_desc_migration_0",
        ],
      },
      TagAndTxIdAndOwnerAndBundledInAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_owner_and_bundled_in_and_data_root_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_owner_and_bundled_in_and_data_root_desc_migration_0",
        ],
      },
      TagAndTxIdAndTargetAndBundledInAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_target_and_bundled_in_and_data_root_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_target_and_bundled_in_and_data_root_desc_migration_0",
        ],
      },
      TagAndOwnerAndTargetAndBundledInAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_owner_and_target_and_bundled_in_and_data_root_asc_migration_0",
          "tx_tag_gql_by_owner_and_target_and_bundled_in_and_data_root_desc_migration_0",
        ],
      },
      TagAndTxIdAndOwnerAndTargetAndBundledInAndDataRoot: {
        keyspace: KEYSPACE,
        tables: [
          "tx_tag_gql_by_tx_id_and_owner_and_target_and_bundled_in_and_data_root_asc_migration_0",
          "tx_tag_gql_by_tx_id_and_owner_and_target_and_bundled_in_and_data_root_desc_migration_0",
        ],
      },
    },
  });
