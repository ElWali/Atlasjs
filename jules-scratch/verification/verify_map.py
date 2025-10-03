from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # Listen for console events and print them
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text()}"))

    page.goto("http://localhost:8000/Atlasona.html")
    try:
        # Wait for a loaded tile image to appear
        page.wait_for_selector('#map img.leaflet-tile-loaded', timeout=10000) # Increased timeout
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Verification screenshot taken.")
    except Exception as e:
        print(f"An error occurred: {e}")
        # Take a screenshot anyway to see the state of the page
        page.screenshot(path="jules-scratch/verification/error.png")
        print("Error screenshot taken.")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)