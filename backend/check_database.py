#!/usr/bin/env python3
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_database():
    load_dotenv()
    
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔍 Checking registered creators...")
    
    creators = await db.creators.find({}).to_list(100)
    
    if not creators:
        print("❌ No creators found in database")
    else:
        for creator in creators:
            print(f"\n✅ Found creator:")
            print(f"   YouTube Channel ID: {creator.get('youtubeChannelId', 'Not set')}")
            print(f"   YouTube Channel Name: {creator.get('youtubeChannelName', 'Not set')}")
            print(f"   Legacy Channel ID: {creator.get('channelId', 'Not set')}")
            print(f"   Wallet Address: {creator.get('walletAddress', 'Not set')}")
            print(f"   Default Tip Amount: ${creator.get('defaultTipAmount', 'Not set')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_database())