import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        try:
            await page.goto("http://localhost:8000/Atlasonajs.html")
            # Wait for at least one tile to be loaded.
            await page.wait_for_selector(".atlas-tile-loaded", state="visible")
            # A short delay to ensure tiles are rendered
            await page.wait_for_timeout(1000)
            await page.screenshot(path="jules-scratch/verification/verification.png")
            print("Screenshot taken successfully.")
        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())