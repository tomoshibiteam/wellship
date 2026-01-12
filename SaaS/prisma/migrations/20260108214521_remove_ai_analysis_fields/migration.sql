/*
  Warnings:

  - You are about to drop the column `kioskVesselId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `aiAnalysisStatus` on the `MealFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `aiLeftoverPercent` on the `MealFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `aiLeftoverLevel` on the `MealFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `aiConfidence` on the `MealFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `aiNote` on the `MealFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `aiAnalyzedAt` on the `MealFeedback` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Vessel" ADD COLUMN "defaultMaxCookingTime" INTEGER;
ALTER TABLE "Vessel" ADD COLUMN "defaultSeason" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "healthScore" REAL NOT NULL,
    "crewCount" INTEGER NOT NULL DEFAULT 20,
    "budgetPerPerson" INTEGER NOT NULL DEFAULT 1200,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "vesselId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuPlan_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuPlan" ("createdAt", "crewCount", "date", "healthScore", "id", "mealType", "updatedAt", "vesselId") SELECT "createdAt", "crewCount", "date", "healthScore", "id", "mealType", "updatedAt", "vesselId" FROM "MenuPlan";
DROP TABLE "MenuPlan";
ALTER TABLE "new_MenuPlan" RENAME TO "MenuPlan";
CREATE INDEX "MenuPlan_vesselId_idx" ON "MenuPlan"("vesselId");
CREATE UNIQUE INDEX "MenuPlan_vesselId_date_mealType_key" ON "MenuPlan"("vesselId", "date", "mealType");
CREATE TABLE "new_MealFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "satisfaction" INTEGER NOT NULL,
    "volumeFeeling" TEXT NOT NULL,
    "leftover" TEXT NOT NULL,
    "comment" TEXT,
    "photoUrl" TEXT,
    "reasonTags" TEXT,
    "menuPlanId" TEXT,
    "vesselId" TEXT,
    "crewMemberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealFeedback_menuPlanId_fkey" FOREIGN KEY ("menuPlanId") REFERENCES "MenuPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealFeedback_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealFeedback_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MealFeedback" ("comment", "createdAt", "crewMemberId", "date", "id", "leftover", "mealType", "menuPlanId", "photoUrl", "reasonTags", "satisfaction", "updatedAt", "vesselId", "volumeFeeling") SELECT "comment", "createdAt", "crewMemberId", "date", "id", "leftover", "mealType", "menuPlanId", "photoUrl", "reasonTags", "satisfaction", "updatedAt", "vesselId", "volumeFeeling" FROM "MealFeedback";
DROP TABLE "MealFeedback";
ALTER TABLE "new_MealFeedback" RENAME TO "MealFeedback";
CREATE INDEX "MealFeedback_vesselId_idx" ON "MealFeedback"("vesselId");
CREATE INDEX "MealFeedback_date_idx" ON "MealFeedback"("date");
CREATE INDEX "MealFeedback_crewMemberId_idx" ON "MealFeedback"("crewMemberId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CHEF',
    "companyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("companyId", "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt") SELECT "companyId", "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "User_role_idx" ON "User"("role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
