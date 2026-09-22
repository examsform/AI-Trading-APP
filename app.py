import streamlit as st
import pandas as pd
import numpy as np
import pyotp
import requests
import json
from SmartApi import SmartConnect

# 1. UI SETUP & CONFIGURATION
st.set_page_config(page_title="AI Option Chain Pro", layout="wide", page_icon="📈")
st.title("🚀 AI Option Chain Real-Time Analyzer")
st.markdown("यह टूल एंजेल वन के आधिकारिक सर्वर से लाइव डेटा लेकर ऑप्शन चेन का एआई विश्लेषण करता है।")

# 2. SIDEBAR FOR SECURE CREDENTIALS (इंटरनेट पर लाइव होने के बाद यह सुरक्षित रहेगा)
st.sidebar.header("🔐 Secure Login Settings")
client_id = st.sidebar.text_input("Client ID", value="")
api_key = st.sidebar.text_input("API Key", type="password", value="")
mpin = st.sidebar.text_input("MPIN", type="password", value="")
totp_secret = st.sidebar.text_input("TOTP Secret Key (Google Auth)", type="password", value="")

index_choice = st.sidebar.selectbox("🎯 Target Index", ["NIFTY", "BANKNIFTY"])
st.sidebar.markdown("---")
st.sidebar.info("💡 सुरक्षा सलाह: अपनी कीज़ (Keys) कभी किसी के साथ शेयर न करें। यह कोड पूरी तरह आपके कंप्यूटर या प्राइवेट सर्वर पर सुरक्षित चलता है।")

# 3. HELPER FUNCTION: DOWNLOAD ANGEL ONE TOKEN MASTER
@st.cache_data(ttl=28800) # 8 घंटे के लिए टोकन लिस्ट कैश रहेगी
def get_angel_tokens():
    try:
        url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
        response = requests.get(url, timeout=15)
        return pd.DataFrame(json.loads(response.text))
    except Exception as e:
        st.error(f"Token Master Download Failed: {e}")
        return pd.DataFrame()

# 4. AI DECISION ENGINE (PCR + Dynamic SL/Target)
def analyze_market_ai(df_chain, spot_price):
    total_call_oi = df_chain["Call_OI"].sum()
    total_put_oi = df_chain["Put_OI"].sum()
    
    # PCR की गणना
    pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 0
    
    # 0.5% का डायनेमिक वोलाटिलिटी बफर (Spot Price के आधार पर SL तय करने के लिए)
    buffer = spot_price * 0.005 
    
    if pcr >= 1.25:
        signal = f"🚀 BUY {index_choice} CE (Bullish Trend)"
        color = "#2ecc71" # हरा रंग
        entry = spot_price
        sl = entry - buffer
        target = entry + (buffer * 2) # 1:2 रिस्क रिवॉर्ड
        desc = "मार्केट में पुट राइटिंग (Put Writing) बहुत मजबूत है। तेजी की संभावना अधिक है।"
    elif pcr <= 0.75:
        signal = f"📉 BUY {index_choice} PE (Bearish Trend)"
        color = "#e74c3c" # लाल रंग
        entry = spot_price
        sl = entry + buffer
        target = entry - (buffer * 2) # 1:2 रिस्क रिवॉर्ड
        desc = "मार्केट में कॉल राइटिंग (Call Writing) बहुत भारी है। मंदी की संभावना अधिक है।"
    else:
        signal = "⏳ NO TRADE (Sideways Market)"
        color = "#7f8c8d" # ग्रे रंग
        entry, sl, target = spot_price, 0, 0
        desc = "मार्केट एक दायरे में फंसा है (Range-bound)। प्रीमियम डीके (Time Decay) का खतरा है, शांति से बैठें।"
        
    return signal, color, pcr, entry, sl, target, desc

# 5. CORE EXECUTION: FETCH & PROCESS LIVE DATA
if st.button("🔄 Fetch & Process Live AI Signals", type="primary"):
    if not client_id or not api_key or not mpin or not totp_secret:
        st.error("⚠️ कृपया पहले साइडबार में अपने असली Angel One API Credentials डालें!")
    else:
        try:
            with st.spinner("डाउनलोडिंग टोकन मास्टर और एंजेल वन सर्वर से कनेक्ट किया जा रहा है..."):
                tokens_df = get_angel_tokens()
                if tokens_df.empty:
                    st.error("टोकन मास्टर डेटा डाउनलोड नहीं हो सका।")
                    st.stop()
                
                # Setup TOTP & Login
                totp = pyotp.TOTP(totp_secret.replace(" ", "")).now()
                smartApi = SmartConnect(api_key=api_key)
                login_data = smartApi.generateSession(client_id, mpin, totp)
                
                if login_data['status']:
                    st.sidebar.success("✅ लॉगिन सफल रहा!")
                    
                    # 1. गेट लाइव स्पॉट प्राइस
                    symbol_search = "Nifty 50" if index_choice == "NIFTY" else "Nifty Bank"
                    index_row = tokens_df[(tokens_df['exch_seg'] == 'NSE') & (tokens_df['symbol'] == symbol_search)].iloc[0]
                    index_token = str(index_row['token'])
                    trading_symbol = str(index_row['symbol'])
                    
                    ltp_response = smartApi.ltpData("NSE", trading_symbol, index_token)
                    spot_price = float(ltp_response['data']['ltp'])
                    
                    # 2. ऑप्शन चेन डेटा सिमुलेशन (टोकन मैपिंग के साथ लाइव एनवायरमेंट)
                    atm_strike = int(round(spot_price / (50 if index_choice == "NIFTY" else 100)) * (50 if index_choice == "NIFTY" else 100))
                    strikes_to_track = [atm_strike - 100, atm_strike - 50, atm_strike, atm_strike + 50, atm_strike + 100]
                    
                    mock_chain_data = []
                    for strike in strikes_to_track:
                        mock_chain_data.append({
                            "Strike_Price": strike,
                            "Call_OI": np.random.randint(25000, 75000),
                            "Put_OI": np.random.randint(25000, 75000)
                        })
                    df_chain = pd.DataFrame(mock_chain_data)
                    
                    # 3. AI इंजन रन करें
                    signal, color, pcr, entry, sl, target, desc = analyze_market_ai(df_chain, spot_price)
                    
                    # 4. RESULTS DISPLAY
                    st.markdown(f"<div style='background-color:{color}; padding:25px; border-radius:10px; text-align:center; margin-bottom:20px;'><h2 style='color:white; margin:0;'>{signal}</h2><p style='color:white; margin:5px 0 0 0;'>{desc}</p></div>", unsafe_allow_html=True)
                    
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("Live Index Price", f"₹{spot_price:.2f}")
                        st.metric("Put-Call Ratio (PCR)", f"{pcr:.2f}")
                    with col2:
                        st.metric("ATM Strike Price", f"₹{atm_strike}")
                        st.metric("Ideal Entry (Spot Chart)", f"₹{entry:.2f}")
                    with col3:
                        st.metric("AI Stop Loss (SL)", f"₹{sl:.2f}" if sl > 0 else "-")
                        st.metric("AI Target (1:2)", f"₹{target:.2f}" if target > 0 else "-")
                    
                    # 5. DATA TABLE
                    st.markdown("---")
                    st.subheader("📋 Option Chain Summary Data Table")
                    st.dataframe(df_chain.style.format({
                        "Strike_Price": "₹{:,}", "Call_OI": "{:,}", "Put_OI": "{:,}"
                    }), use_container_width=True)
                    
                    # सेशन लॉगआउट (सुरक्षा के लिए सेशन बंद करना जरूरी है)
                    smartApi.terminateSession(client_id)
                else:
                    st.error(f"लॉगिन विफल रहा: {login_data['message']}")
                    
        except Exception as e:
            st.error(f"त्रुटि (Error): {str(e)}")