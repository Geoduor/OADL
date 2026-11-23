-- AlterTable
ALTER TABLE "order_status_history" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "changedByUserId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assignedAgentId" TEXT;

-- CreateIndex
CREATE INDEX "orders_assignedAgentId_idx" ON "orders"("assignedAgentId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
