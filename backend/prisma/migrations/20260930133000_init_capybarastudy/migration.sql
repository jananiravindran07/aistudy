CREATE TYPE "CapybaraMessageRole" AS ENUM ('user', 'assistant');

CREATE TABLE "CapybaraUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "carrots" INTEGER NOT NULL DEFAULT 0,
    "happiness" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastSessionAt" TIMESTAMP(3),
    CONSTRAINT "CapybaraUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'General',
    "difficulty" TEXT NOT NULL DEFAULT 'Intermediate',
    "userId" TEXT NOT NULL,
    CONSTRAINT "CapybaraConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" "CapybaraMessageRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "CapybaraMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CapybaraDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraStudySession" (
    "id" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "goal" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CapybaraStudySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CapybaraNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraQuiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CapybaraQuiz_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraStudyPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CapybaraStudyPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CapybaraTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapybaraPetState" (
    "id" TEXT NOT NULL,
    "carrots" INTEGER NOT NULL DEFAULT 0,
    "happiness" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "accessories" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CapybaraPetState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CapybaraUser_email_key" ON "CapybaraUser"("email");
CREATE UNIQUE INDEX "CapybaraPetState_userId_key" ON "CapybaraPetState"("userId");

ALTER TABLE "CapybaraConversation" ADD CONSTRAINT "CapybaraConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CapybaraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapybaraMessage" ADD CONSTRAINT "CapybaraMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CapybaraConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CapybaraDocument" ADD CONSTRAINT "CapybaraDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CapybaraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapybaraStudySession" ADD CONSTRAINT "CapybaraStudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CapybaraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapybaraNote" ADD CONSTRAINT "CapybaraNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CapybaraConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CapybaraNote" ADD CONSTRAINT "CapybaraNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CapybaraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapybaraQuiz" ADD CONSTRAINT "CapybaraQuiz_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CapybaraConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CapybaraQuiz" ADD CONSTRAINT "CapybaraQuiz_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CapybaraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapybaraStudyPlan" ADD CONSTRAINT "CapybaraStudyPlan_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CapybaraConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CapybaraStudyPlan" ADD CONSTRAINT "CapybaraStudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CapybaraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapybaraTask" ADD CONSTRAINT "CapybaraTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CapybaraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapybaraPetState" ADD CONSTRAINT "CapybaraPetState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CapybaraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;