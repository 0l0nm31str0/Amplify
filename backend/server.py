from fastapi import FastAPI, APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import secrets

# Google OAuth imports
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Amplify API v2.0", version="2.0.0")

# Add session middleware (required for OAuth)
app.add_middleware(SessionMiddleware, secret_key=secrets.token_hex(32))

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
REDIRECT_URI = os.environ.get('OAUTH_REDIRECT_URI', 'https://28bc5347-71d7-42a5-9c82-4860713f9f76.preview.emergentagent.com/api/oauth/youtube/callback')

# OAuth Scopes
SCOPES = ['https://www.googleapis.com/auth/youtube.readonly']

# Define Enhanced Models
class CreatorRegistration(BaseModel):
    channelId: str
    walletAddress: str

class CreatorResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channelId: str
    walletAddress: str
    youtubeChannelId: Optional[str] = None
    youtubeChannelName: Optional[str] = None
    defaultTipAmount: Optional[float] = None
    registeredAt: datetime = Field(default_factory=datetime.utcnow)
    youtubeConnected: bool = False

class TipRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fromWallet: str
    toWallet: str
    channelId: str
    amount: float
    signature: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class TipRecordCreate(BaseModel):
    fromWallet: str
    toWallet: str
    channelId: str
    amount: float
    signature: str

class CreatorSettings(BaseModel):
    defaultTipAmount: float

# Utility Functions
def create_oauth_flow():
    """Create and return Google OAuth flow"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    flow = Flow.from_client_config({
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI]
        }
    }, scopes=SCOPES)
    flow.redirect_uri = REDIRECT_URI
    return flow

async def get_youtube_channel_info(access_token: str):
    """Get YouTube channel information using access token"""
    try:
        from google.oauth2.credentials import Credentials
        credentials = Credentials(token=access_token)
        
        youtube = build('youtube', 'v3', credentials=credentials)
        
        # Get channel information
        request = youtube.channels().list(part='snippet', mine=True)
        response = request.execute()
        
        if response['items']:
            channel = response['items'][0]
            return {
                'channelId': channel['id'],
                'channelName': channel['snippet']['title']
            }
        else:
            raise HTTPException(status_code=404, detail="No YouTube channel found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get YouTube channel info: {str(e)}")

# YouTube OAuth Endpoints
@api_router.get("/oauth/youtube/initiate")
async def initiate_youtube_oauth(request: Request, wallet_address: str = Query(...)):
    """Initiate YouTube OAuth flow"""
    try:
        flow = create_oauth_flow()
        
        # Store wallet address in session
        request.session['wallet_address'] = wallet_address
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        # Store state in session for security
        request.session['oauth_state'] = state
        
        return RedirectResponse(url=authorization_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth initiation failed: {str(e)}")

@api_router.get("/oauth/youtube/callback")
async def youtube_oauth_callback(request: Request, code: str = Query(...), state: str = Query(...)):
    """Handle YouTube OAuth callback"""
    try:
        # Verify state parameter
        if request.session.get('oauth_state') != state:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        wallet_address = request.session.get('wallet_address')
        if not wallet_address:
            raise HTTPException(status_code=400, detail="Wallet address not found in session")
        
        # Exchange code for tokens
        flow = create_oauth_flow()
        flow.fetch_token(code=code)
        
        credentials = flow.credentials
        
        # Get YouTube channel information
        channel_info = await get_youtube_channel_info(credentials.token)
        
        # Check if this YouTube channel is already connected to another wallet
        existing_channel = await db.creators.find_one({
            "youtubeChannelId": channel_info['channelId'],
            "walletAddress": {"$ne": wallet_address}
        })
        
        if existing_channel:
            raise HTTPException(status_code=400, detail="This YouTube channel is already connected to another wallet")
        
        # Update creator record
        creator_data = {
            "youtubeChannelId": channel_info['channelId'],
            "youtubeChannelName": channel_info['channelName'],
            "youtubeAccessToken": credentials.token,
            "youtubeRefreshToken": credentials.refresh_token,
            "youtubeConnected": True,
            "connectedAt": datetime.utcnow()
        }
        
        # Update existing creator or create new one
        result = await db.creators.update_one(
            {"walletAddress": wallet_address},
            {"$set": creator_data},
            upsert=True
        )
        
        # Clear session data
        request.session.pop('wallet_address', None)
        request.session.pop('oauth_state', None)
        
        # Redirect to frontend with success
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        return RedirectResponse(url=f"{frontend_url}?oauth=success&channel={channel_info['channelName']}")
        
    except HTTPException:
        raise
    except Exception as e:
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        return RedirectResponse(url=f"{frontend_url}?oauth=error&message={str(e)}")

# Creator Registration Endpoints (Updated)
@api_router.post("/register", response_model=CreatorResponse)
async def register_creator(registration: CreatorRegistration):
    """Register a creator's wallet address with their YouTube channel ID (Legacy endpoint)"""
    
    # Check if channel is already registered
    existing = await db.creators.find_one({"channelId": registration.channelId})
    if existing:
        raise HTTPException(status_code=400, detail="Channel already registered")
    
    # Check if wallet is already registered
    existing_wallet = await db.creators.find_one({"walletAddress": registration.walletAddress})
    if existing_wallet:
        raise HTTPException(status_code=400, detail="Wallet already registered with another channel")
    
    creator_data = CreatorResponse(
        channelId=registration.channelId,
        walletAddress=registration.walletAddress
    )
    
    await db.creators.insert_one(creator_data.dict())
    return creator_data

@api_router.get("/creator")
async def get_creator_by_channel(channelId: Optional[str] = None, walletAddress: Optional[str] = None):
    """Get creator info by channel ID or wallet address"""
    
    if channelId:
        creator = await db.creators.find_one({"$or": [
            {"channelId": channelId},
            {"youtubeChannelId": channelId}
        ]})
    elif walletAddress:
        creator = await db.creators.find_one({"walletAddress": walletAddress})
    else:
        raise HTTPException(status_code=400, detail="Either channelId or walletAddress is required")
    
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    return {
        "channelId": creator.get("youtubeChannelId") or creator.get("channelId"),
        "channelName": creator.get("youtubeChannelName"),
        "walletAddress": creator["walletAddress"],
        "defaultTipAmount": creator.get("defaultTipAmount", 0.1),
        "youtubeConnected": creator.get("youtubeConnected", False),
        "registeredAt": creator.get("registeredAt")
    }

@api_router.put("/creator/settings")
async def update_creator_settings(settings: CreatorSettings, wallet_address: str = Query(...)):
    """Update creator settings like default tip amount"""
    
    creator = await db.creators.find_one({"walletAddress": wallet_address})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    # Update settings
    await db.creators.update_one(
        {"walletAddress": wallet_address},
        {"$set": {"defaultTipAmount": settings.defaultTipAmount}}
    )
    
    return {"message": "Settings updated successfully", "defaultTipAmount": settings.defaultTipAmount}

# Tip Recording Endpoints (Updated)
@api_router.post("/tip", response_model=TipRecord)
async def record_tip(tip: TipRecordCreate):
    """Record a successful tip transaction"""
    
    # Verify the channel exists (check both old and new format)
    creator = await db.creators.find_one({"$or": [
        {"channelId": tip.channelId},
        {"youtubeChannelId": tip.channelId}
    ]})
    
    if not creator:
        raise HTTPException(status_code=404, detail="Channel not registered")
    
    # Verify the tip is going to the right wallet
    if creator["walletAddress"] != tip.toWallet:
        raise HTTPException(status_code=400, detail="Wallet address mismatch")
    
    tip_record = TipRecord(**tip.dict())
    await db.tips.insert_one(tip_record.dict())
    
    return tip_record

@api_router.get("/tips/{channelId}", response_model=List[TipRecord])
async def get_tips_for_channel(channelId: str, limit: int = 50):
    """Get recent tips for a channel"""
    
    tips = await db.tips.find({"channelId": channelId}).sort("timestamp", -1).limit(limit).to_list(limit)
    return [TipRecord(**tip) for tip in tips]

@api_router.get("/tips/wallet/{walletAddress}", response_model=List[TipRecord])
async def get_tips_for_wallet(walletAddress: str, limit: int = 50):
    """Get recent tips received by a wallet"""
    
    tips = await db.tips.find({"toWallet": walletAddress}).sort("timestamp", -1).limit(limit).to_list(limit)
    return [TipRecord(**tip) for tip in tips]

# Stats Endpoints (Updated)
@api_router.get("/stats/{channelId}")
async def get_channel_stats(channelId: str):
    """Get statistics for a channel"""
    
    creator = await db.creators.find_one({"$or": [
        {"channelId": channelId},
        {"youtubeChannelId": channelId}
    ]})
    
    if not creator:
        raise HTTPException(status_code=404, detail="Channel not registered")
    
    # Count total tips
    total_tips = await db.tips.count_documents({"channelId": channelId})
    
    # Sum total amount
    pipeline = [
        {"$match": {"channelId": channelId}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    result = await db.tips.aggregate(pipeline).to_list(1)
    total_amount = result[0]["total"] if result else 0
    
    return {
        "channelId": channelId,
        "channelName": creator.get("youtubeChannelName"),
        "totalTips": total_tips,
        "totalAmount": total_amount,
        "defaultTipAmount": creator.get("defaultTipAmount", 0.1),
        "walletAddress": creator["walletAddress"]
    }

# Health check
@api_router.get("/")
async def root():
    return {"message": "Amplify API v2.0 is running", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    try:
        # Test database connection
        await db.list_collection_names()
        return {"status": "healthy", "database": "connected", "version": "2.0"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("Amplify API v2.0 starting up...")
    
    # Create indexes for better performance
    await db.creators.create_index("channelId", unique=True, sparse=True)
    await db.creators.create_index("youtubeChannelId", unique=True, sparse=True)
    await db.creators.create_index("walletAddress", unique=True)
    await db.tips.create_index("channelId")
    await db.tips.create_index("toWallet")
    await db.tips.create_index("timestamp")
    
    logger.info("Database indexes created")
    logger.info("YouTube OAuth integration ready")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("Database connection closed")