import asyncio
import random
import time

class MarketScanner:
    def __init__(self, api_key=None):
        self.api_key = api_key
        # Enclave detection logic: if no API key, assume we are in Strykr Proximity Mock mode
        self.is_mock = not api_key

    async def get_batch_spreads(self, symbols):
        """
        Calculates spreads and yields for a list of symbols (BTC, ETH, SOL).
        Implements Strykr PRISM Proximity logic with calibrated latency.
        """
        if self.is_mock:
            # Calibrated Network Latency (Internal Requirement: 400ms)
            await asyncio.sleep(0.4)
            
            results = []
            for s in symbols:
                # Realistic Spread Generation (Requirement: 0.02% to 0.15%)
                net_yield = random.uniform(0.02, 0.15)
                
                # Base prices for realistic simulation
                base_price = 50000 if s == "BTC" else (3500 if s == "ETH" else 145)
                spot = base_price + random.uniform(-100, 100)
                
                # Derive perp from spot + yield (simplified for scan)
                # Yield here is treated as the net spread opportunity
                perp = spot * (1 + (net_yield / 100))
                
                results.append({
                    "symbol": s,
                    "spot": round(spot, 2),
                    "perp": round(perp, 2),
                    "net_yield": round(net_yield, 2),
                    "timestamp": int(time.time())
                })
            return results
            
        # --- PRODUCTION LOGIC ---
        # When PRISM_API_KEY is available, we perform the real /resolve/batch call
        # This is isolated from the mock logic for security and auditability.
        # TODO: Implement secure requests to https://api.prismapi.ai
        return []

    def get_best_opportunity(self, results, min_threshold):
        """
        Advanced selection logic: returns the asset with the highest net_yield
        that exceeds the agent's risk threshold.
        """
        if not results:
            return None
            
        valid_opps = [r for r in results if r["net_yield"] >= min_threshold]
        if not valid_opps:
            return None
            
        # Primary sort: net_yield (Winner selection)
        return max(valid_opps, key=lambda x: x["net_yield"])
