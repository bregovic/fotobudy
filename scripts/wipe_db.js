
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function wipe() {
    console.log("🔥 WIPING RAILWAY DATABASE (Media, Events, Sessions)...");

    try {
        const deletedMedia = await prisma.media.deleteMany({});
        console.log(`Deleted Media: ${deletedMedia.count}`);

        const deletedEvents = await prisma.event.deleteMany({});
        console.log(`Deleted Events: ${deletedEvents.count}`);

        const deletedSessions = await prisma.session.deleteMany({});
        console.log(`Deleted Sessions: ${deletedSessions.count}`);

        const deletedAssets = await prisma.asset.deleteMany({});
        console.log(`Deleted Assets: ${deletedAssets.count}`);

        console.log("✅ DATABASE CLEANUP COMPLETE!");
    } catch (e) {
        console.error("Error wiping DB:", e);
    } finally {
        await prisma.$disconnect();
    }
}

wipe();
