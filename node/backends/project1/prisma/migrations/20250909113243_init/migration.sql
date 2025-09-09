/*
  Warnings:

  - You are about to alter the column `data` on the `nodedata` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.

*/
-- AlterTable
ALTER TABLE `nodedata` MODIFY `data` JSON NULL;
