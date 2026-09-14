-- Tamper evident chaining for the audit ledger
-- Every entry stores the hash of the entry before it. that way altering or removing a row breaks every hash that follows and the break point can be located
-- existing rows keep null values and sit before the first chained entry

ALTER TABLE "audit_logs"
  ADD COLUMN "chain_index" BIGINT,
  ADD COLUMN "prev_hash" VARCHAR(64),
  ADD COLUMN "current_hash" VARCHAR(64);

CREATE UNIQUE INDEX "audit_logs_chain_index_key" ON "audit_logs"("chain_index");