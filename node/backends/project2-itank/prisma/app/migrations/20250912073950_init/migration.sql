-- CreateTable
CREATE TABLE `itankLatestLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `imei` VARCHAR(191) NOT NULL,
    `data` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `itankLatestLog_imei_key`(`imei`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
