import requests
import uuid
import json
import sys
from datetime import datetime

class AmplifyAPITester:
    def __init__(self, base_url="https://28bc5347-71d7-42a5-9c82-4860713f9f76.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_wallet = f"AmplifyTest{uuid.uuid4().hex[:8]}"
        self.test_channel = f"TestChannel{uuid.uuid4().hex[:8]}"

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            
            print(f"Status Code: {response.status_code}")
            
            try:
                response_data = response.json()
                print(f"Response: {json.dumps(response_data, indent=2)}")
            except:
                print(f"Raw Response: {response.text}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
            
            return success, response
        
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, None

    def test_health_check(self):
        """Test the health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        if success:
            data = response.json()
            if data.get("status") == "healthy" and data.get("database") == "connected":
                print("✅ Health check response is valid")
                return True
            else:
                print("❌ Health check response format is incorrect")
                return False
        return False

    def test_creator_registration(self):
        """Test creator registration"""
        success, response = self.run_test(
            "Creator Registration",
            "POST",
            "register",
            200,
            data={
                "channelId": self.test_channel,
                "walletAddress": self.test_wallet
            }
        )
        if success:
            data = response.json()
            if data.get("channelId") == self.test_channel and data.get("walletAddress") == self.test_wallet:
                print("✅ Creator registration response is valid")
                return True
            else:
                print("❌ Creator registration response format is incorrect")
                return False
        return False

    def test_duplicate_registration(self):
        """Test duplicate registration (should fail)"""
        success, response = self.run_test(
            "Duplicate Registration (Expected to Fail)",
            "POST",
            "register",
            400,  # Expecting a 400 Bad Request
            data={
                "channelId": self.test_channel,
                "walletAddress": self.test_wallet
            }
        )
        # For this test, success means we got the expected 400 status code
        return success

    def test_get_creator_by_channel(self):
        """Test getting creator by channel ID"""
        success, response = self.run_test(
            "Get Creator by Channel ID",
            "GET",
            "creator",
            200,
            params={"channelId": self.test_channel}
        )
        if success:
            data = response.json()
            if data.get("channelId") == self.test_channel and data.get("walletAddress") == self.test_wallet:
                print("✅ Get creator by channel response is valid")
                return True
            else:
                print("❌ Get creator by channel response format is incorrect")
                return False
        return False

    def test_get_creator_by_wallet(self):
        """Test getting creator by wallet address"""
        success, response = self.run_test(
            "Get Creator by Wallet Address",
            "GET",
            "creator",
            200,
            params={"walletAddress": self.test_wallet}
        )
        if success:
            data = response.json()
            if data.get("channelId") == self.test_channel and data.get("walletAddress") == self.test_wallet:
                print("✅ Get creator by wallet response is valid")
                return True
            else:
                print("❌ Get creator by wallet response format is incorrect")
                return False
        return False

    def test_get_nonexistent_creator(self):
        """Test getting a creator that doesn't exist"""
        success, response = self.run_test(
            "Get Nonexistent Creator (Expected to Fail)",
            "GET",
            "creator",
            404,  # Expecting a 404 Not Found
            params={"channelId": f"NonExistentChannel{uuid.uuid4().hex}"}
        )
        # For this test, success means we got the expected 404 status code
        return success

    def test_record_tip(self):
        """Test recording a tip transaction"""
        tip_data = {
            "fromWallet": f"TipperWallet{uuid.uuid4().hex[:8]}",
            "toWallet": self.test_wallet,
            "channelId": self.test_channel,
            "amount": 0.1,
            "signature": f"SolanaSignature{uuid.uuid4().hex}"
        }
        
        success, response = self.run_test(
            "Record Tip Transaction",
            "POST",
            "tip",
            200,
            data=tip_data
        )
        
        if success:
            data = response.json()
            if (data.get("fromWallet") == tip_data["fromWallet"] and 
                data.get("toWallet") == tip_data["toWallet"] and
                data.get("channelId") == tip_data["channelId"]):
                print("✅ Record tip response is valid")
                return True
            else:
                print("❌ Record tip response format is incorrect")
                return False
        return False

    def test_get_tips_for_channel(self):
        """Test getting tips for a channel"""
        success, response = self.run_test(
            "Get Tips for Channel",
            "GET",
            f"tips/{self.test_channel}",
            200
        )
        # Just check if we get a 200 response with an array
        if success and isinstance(response.json(), list):
            print("✅ Get tips for channel response is valid")
            return True
        return False

    def test_get_channel_stats(self):
        """Test getting channel statistics"""
        success, response = self.run_test(
            "Get Channel Statistics",
            "GET",
            f"stats/{self.test_channel}",
            200
        )
        if success:
            data = response.json()
            if (data.get("channelId") == self.test_channel and 
                "totalTips" in data and 
                "totalAmount" in data and
                data.get("walletAddress") == self.test_wallet):
                print("✅ Get channel stats response is valid")
                return True
            else:
                print("❌ Get channel stats response format is incorrect")
                return False
        return False

def main():
    print("=" * 50)
    print("AMPLIFY API TESTING")
    print("=" * 50)
    
    tester = AmplifyAPITester()
    
    # Phase 1: Basic functionality
    print("\n📋 PHASE 1: BASIC FUNCTIONALITY")
    health_check_passed = tester.test_health_check()
    
    if not health_check_passed:
        print("\n❌ Health check failed. Stopping tests.")
        return 1
    
    # Phase 2: Creator registration and lookup
    print("\n📋 PHASE 2: CREATOR REGISTRATION AND LOOKUP")
    registration_passed = tester.test_creator_registration()
    
    if not registration_passed:
        print("\n❌ Creator registration failed. Stopping tests.")
        return 1
    
    # Continue with more tests
    tester.test_duplicate_registration()
    tester.test_get_creator_by_channel()
    tester.test_get_creator_by_wallet()
    tester.test_get_nonexistent_creator()
    
    # Phase 3: Tip functionality
    print("\n📋 PHASE 3: TIP FUNCTIONALITY")
    tester.test_record_tip()
    tester.test_get_tips_for_channel()
    tester.test_get_channel_stats()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 TESTS PASSED: {tester.tests_passed}/{tester.tests_run}")
    print("=" * 50)
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())