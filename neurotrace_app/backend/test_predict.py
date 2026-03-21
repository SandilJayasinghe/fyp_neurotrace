import http.client
import json

def test():
    conn = http.client.HTTPConnection("127.0.0.1", 8421)
    # Create sample data with 150 keystrokes
    ks = [{"key":"a", "hold_time":100.0, "flight_time":50.0, "latency":150.0}] * 150
    data = {
        "session_id": "test_persistent_123",
        "keystrokes": ks
    }
    
    payload = json.dumps(data)
    headers = {'Content-Type': 'application/json'}
    
    try:
        print("Sending predict request...")
        conn.request("POST", "/predict", payload, headers)
        res = conn.getresponse()
        print(f"Status: {res.status}")
        data_res = res.read()
        if res.status == 200:
            resp_json = json.loads(data_res)
            print("✅ PREDICT SUCCESS")
            print(f"Decision path length: {len(resp_json.get('decision_path', []))}")
            print(f"Top feature: {resp_json['top_features'][0]['name']}")
        else:
            print(f"❌ FAILED: {data_res.decode()}")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    test()
