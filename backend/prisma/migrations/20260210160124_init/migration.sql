-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'guest');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('user', 'guest', 'imported');

-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "lastLogin" TIMESTAMP(3),
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "guestCreatedBy" TEXT,
    "originalGuestId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerIdentity" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "userId" TEXT,
    "type" "IdentityType" NOT NULL DEFAULT 'guest',
    "eloData" JSONB NOT NULL DEFAULT '{}',
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "lastGameAt" TIMESTAMP(3),
    "nameHistory" JSONB NOT NULL DEFAULT '[]',
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "linkedIdentities" JSONB NOT NULL DEFAULT '[]',
    "mergedIntoId" TEXT,
    "createdById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendRequest" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAlias" (
    "id" TEXT NOT NULL,
    "aliasName" TEXT NOT NULL,
    "userId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "gameData" JSONB NOT NULL DEFAULT '{}',
    "shareId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "gameData" JSONB NOT NULL,
    "migratedFrom" TEXT,
    "migratedAt" TIMESTAMP(3),
    "originalGameId" TEXT,
    "shareId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gameTypeName" TEXT,
    "gameData" JSONB NOT NULL DEFAULT '{}',
    "gameType" TEXT NOT NULL DEFAULT 'table',
    "gameFinished" BOOLEAN NOT NULL DEFAULT false,
    "playerCount" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "targetNumber" INTEGER,
    "lowIsBetter" BOOLEAN NOT NULL DEFAULT false,
    "identitiesMigrated" BOOLEAN NOT NULL DEFAULT false,
    "migratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "localVersion" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "serverVersion" INTEGER NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "serverVersion" INTEGER NOT NULL,
    "gameState" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemGameTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetNumber" INTEGER,
    "lowIsBetter" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemGameTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "localId" TEXT,
    "name" TEXT NOT NULL,
    "targetNumber" INTEGER,
    "lowIsBetter" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSuggestion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetNumber" INTEGER,
    "lowIsBetter" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "suggestedById" TEXT,
    "suggestionNote" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserFriends" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "PlayerIdentity_normalizedName_isDeleted_idx" ON "PlayerIdentity"("normalizedName", "isDeleted");

-- CreateIndex
CREATE INDEX "PlayerIdentity_userId_isDeleted_idx" ON "PlayerIdentity"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "PlayerIdentity_type_isDeleted_idx" ON "PlayerIdentity"("type", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_primary_identity" ON "PlayerIdentity"("userId", "type");

-- CreateIndex
CREATE INDEX "FriendRequest_receiverId_status_idx" ON "FriendRequest"("receiverId", "status");

-- CreateIndex
CREATE INDEX "FriendRequest_senderId_status_idx" ON "FriendRequest"("senderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequest_senderId_receiverId_key" ON "FriendRequest"("senderId", "receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAlias_aliasName_key" ON "PlayerAlias"("aliasName");

-- CreateIndex
CREATE INDEX "PlayerAlias_userId_idx" ON "PlayerAlias"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_localId_key" ON "Game"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_shareId_key" ON "Game"("shareId");

-- CreateIndex
CREATE INDEX "Game_userId_createdAt_idx" ON "Game"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Game_shareId_idx" ON "Game"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "WizardGame_localId_key" ON "WizardGame"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "WizardGame_shareId_key" ON "WizardGame"("shareId");

-- CreateIndex
CREATE INDEX "WizardGame_userId_createdAt_idx" ON "WizardGame"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WizardGame_shareId_idx" ON "WizardGame"("shareId");

-- CreateIndex
CREATE INDEX "WizardGame_migratedFrom_migratedAt_idx" ON "WizardGame"("migratedFrom", "migratedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TableGame_localId_key" ON "TableGame"("localId");

-- CreateIndex
CREATE INDEX "TableGame_userId_createdAt_idx" ON "TableGame"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_eventId_key" ON "GameEvent"("eventId");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_serverVersion_idx" ON "GameEvent"("gameId", "serverVersion");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_timestamp_idx" ON "GameEvent"("gameId", "timestamp");

-- CreateIndex
CREATE INDEX "GameEvent_clientId_idx" ON "GameEvent"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_gameId_eventId_key" ON "GameEvent"("gameId", "eventId");

-- CreateIndex
CREATE INDEX "GameSnapshot_gameId_serverVersion_idx" ON "GameSnapshot"("gameId", "serverVersion" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GameSnapshot_gameId_serverVersion_key" ON "GameSnapshot"("gameId", "serverVersion");

-- CreateIndex
CREATE INDEX "SystemGameTemplate_name_idx" ON "SystemGameTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameTemplate_localId_key" ON "UserGameTemplate"("localId");

-- CreateIndex
CREATE INDEX "UserGameTemplate_userId_idx" ON "UserGameTemplate"("userId");

-- CreateIndex
CREATE INDEX "TemplateSuggestion_approved_idx" ON "TemplateSuggestion"("approved");

-- CreateIndex
CREATE UNIQUE INDEX "_UserFriends_AB_unique" ON "_UserFriends"("A", "B");

-- CreateIndex
CREATE INDEX "_UserFriends_B_index" ON "_UserFriends"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_guestCreatedBy_fkey" FOREIGN KEY ("guestCreatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerIdentity" ADD CONSTRAINT "PlayerIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerIdentity" ADD CONSTRAINT "PlayerIdentity_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "PlayerIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerIdentity" ADD CONSTRAINT "PlayerIdentity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAlias" ADD CONSTRAINT "PlayerAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardGame" ADD CONSTRAINT "WizardGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableGame" ADD CONSTRAINT "TableGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameTemplate" ADD CONSTRAINT "UserGameTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSuggestion" ADD CONSTRAINT "TemplateSuggestion_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserFriends" ADD CONSTRAINT "_UserFriends_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserFriends" ADD CONSTRAINT "_UserFriends_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
