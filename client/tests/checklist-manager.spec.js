// tests/checklist-manager.spec.js
import { test, expect } from "@playwright/test";
import path from "path";

// A helper function to set up the page with a character and some optional races.
// This reduces code duplication across tests.
async function setupInitialChecklist(page) {
  await page.goto("/");
  await page
    .getByPlaceholder("Search...")
    .pressSequentially("Symboli Rudolf (Original)", { delay: 30 });
  await page
    .getByRole("listitem", { name: "Symboli Rudolf (Original)" })
    .click();

  // Wait for the table to be ready
  await expect(page.locator("tbody tr").first()).toBeVisible();

  // Select a few optional races to make the checklist distinct
  await page
    .locator("tr")
    .filter({ hasText: "Takarazuka Kinen" })
    .first()
    .getByRole("checkbox")
    .check();
  await page
    .locator("tr")
    .filter({ hasText: "Mile Championship" })
    .first()
    .getByRole("checkbox")
    .check();

  // Assert that the initial state is correct before saving
  await expect(page.locator(".generate-button")).toContainText(
    "View Checklist (12)"
  );
}

test.describe("Checklist Manager: Save, Load, and Overwrite", () => {
  test("should save a new checklist, clear the planner, and then load it", async ({
    page,
  }) => {
    await setupInitialChecklist(page);
    const checklistName = "Rudolf Triple Crown Plan";

    // Save the checklist
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    const saveModal = page.getByRole("dialog", { name: "Save Checklist" });
    await expect(saveModal).toBeVisible();
    await saveModal.getByRole("textbox").fill(checklistName);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(saveModal).not.toBeVisible();
    await expect(page.getByText(checklistName)).toBeVisible();

    // Now, clear the planner by selecting a different character
    await page.getByPlaceholder("Search...").fill("Oguri Cap (Original)");
    await page.getByRole("listitem", { name: "Oguri Cap (Original)" }).click();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );

    // Load the saved checklist
    const savedItem = page.locator(".saved-checklist-item", {
      hasText: checklistName,
    });
    await savedItem.getByRole("button", { name: "Load" }).click();

    // Verify the state was restored
    await expect(page.getByPlaceholder("Search...")).toHaveValue(
      /Symboli Rudolf/
    );
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (12)"
    );

    // Verify one of the optional races is still checked
    const mileChampRow = page
      .locator("tr")
      .filter({ hasText: "Mile Championship" })
      .first();
    await expect(mileChampRow.getByRole("checkbox")).toBeChecked();
  });

  test("should prompt for overwrite when saving with an existing name", async ({
    page,
  }) => {
    await setupInitialChecklist(page);
    const checklistName = "Rudolf Overwrite Test";

    // First save
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(checklistName);
    await page.getByRole("button", { name: "Save" }).click();

    // Change something - e.g., unselect a race
    await page
      .locator("tr")
      .filter({ hasText: "Mile Championship" })
      .first()
      .getByRole("checkbox")
      .uncheck();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (11)"
    );

    // Attempt to save again with the same name
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(checklistName);
    await page.getByRole("button", { name: "Save" }).click();

    // Overwrite modal should appear
    const overwriteModal = page.getByRole("dialog", {
      name: "Overwrite Checklist",
    });
    await expect(overwriteModal).toBeVisible();
    await page.getByRole("button", { name: "Overwrite" }).click();
    await expect(overwriteModal).not.toBeVisible();

    // Clear and load to verify the *overwritten* (newer) version was saved
    await page.getByPlaceholder("Search...").fill("Oguri Cap (Original)");
    await page.getByRole("listitem", { name: "Oguri Cap (Original)" }).click();
    await page
      .locator(".saved-checklist-item")
      .getByRole("button", { name: "Load" })
      .click();

    // Assert the count is 11, not 12
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (11)"
    );
  });
});

test.describe("Checklist Manager: CRUD and Reordering", () => {
  test.beforeEach(async ({ page }) => {
    // Set up two checklists for these tests
    await setupInitialChecklist(page);
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Checklist Alpha");
    await page.getByRole("button", { name: "Save" }).click();

    await page.getByPlaceholder("Search...").fill("Oguri Cap (Original)");
    await page.getByRole("listitem", { name: "Oguri Cap (Original)" }).click();
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Checklist Zulu");
    await page.getByRole("button", { name: "Save" }).click();
  });

  test("should rename a checklist", async ({ page }) => {
    const checklistItem = page.locator(".saved-checklist-item", {
      hasText: "Checklist Alpha",
    });
    await checklistItem.getByRole("button", { name: "Rename" }).click();

    const renameModal = page.getByRole("dialog", { name: "Rename Checklist" });
    await expect(renameModal).toBeVisible();
    const input = renameModal.getByRole("textbox");
    await expect(input).toHaveValue("Checklist Alpha");
    await input.fill("Checklist Bravo");
    await page.getByRole("button", { name: "Rename" }).click();

    await expect(renameModal).not.toBeVisible();
    await expect(
      page.locator(".saved-checklist-item", { hasText: "Checklist Alpha" })
    ).not.toBeVisible();
    await expect(
      page.locator(".saved-checklist-item", { hasText: "Checklist Bravo" })
    ).toBeVisible();
  });

  test("should delete a checklist", async ({ page }) => {
    const checklistItem = page.locator(".saved-checklist-item", {
      hasText: "Checklist Zulu",
    });
    await checklistItem.getByRole("button", { name: "Delete" }).click();

    // Confirmation toast appears
    const toast = page.getByRole("alert");
    await expect(toast).toContainText(
      /Delete checklist "Checklist Zulu"\? This cannot be undone./
    );
    await toast.getByRole("button", { name: "Confirm" }).click();

    await expect(checklistItem).not.toBeVisible();
  });

  test("should reorder and sort checklists", async ({ page }) => {
    const checklists = page.locator(".saved-checklist-item .checklist-name");
    await expect(checklists).toHaveText(["Checklist Alpha", "Checklist Zulu"]);

    // Move Zulu up
    const zuluItem = page.locator(".saved-checklist-item", {
      hasText: "Checklist Zulu",
    });
    await zuluItem.getByRole("button", { name: "Move Up" }).click();
    await expect(checklists).toHaveText(["Checklist Zulu", "Checklist Alpha"]);

    // Move Zulu down
    await zuluItem.getByRole("button", { name: "Move Down" }).click();
    await expect(checklists).toHaveText(["Checklist Alpha", "Checklist Zulu"]);

    // Sort by name
    await page.getByRole("button", { name: "Sort by Name (A-Z)" }).click();
    await expect(checklists).toHaveText(["Checklist Alpha", "Checklist Zulu"]);

    // Sort by character
    await page.getByRole("button", { name: "Sort by Character" }).click();
    await expect(checklists).toHaveText(["Checklist Zulu", "Checklist Alpha"]);
  });
});

test.describe("Checklist Manager: Import and Export", () => {
  const singleChecklistPath = path.join(
    __dirname,
    "test-data",
    "single-checklist.json"
  );
  const allChecklistsPath = path.join(
    __dirname,
    "test-data",
    "all-checklists.json"
  );

  test("should export a single checklist", async ({ page }) => {
    await setupInitialChecklist(page);
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Export Me");
    await page.getByRole("button", { name: "Save" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page
      .locator(".saved-checklist-item", { hasText: "Export Me" })
      .getByRole("button", { name: "Export" })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Export Me.json");
  });

  test("should export all checklists", async ({ page }) => {
    await setupInitialChecklist(page); // Creates one checklist
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("First");
    await page.getByRole("button", { name: "Save" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export All" }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      "umamusume-race-planner-all.json"
    );
  });

  test("should import a single checklist", async ({ page }) => {
    await page.setInputFiles("input[type=file] >> nth=1", singleChecklistPath);

    const importedItem = page.locator(".saved-checklist-item", {
      hasText: "Imported Single Plan",
    });
    await expect(importedItem).toBeVisible();

    await importedItem.getByRole("button", { name: "Load" }).click();
    await expect(page.getByPlaceholder("Search...")).toHaveValue(
      /Kitasan Black/
    );
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (11)"
    );
  });

  test("should import all checklists and overwrite existing", async ({
    page,
  }) => {
    // Create a dummy checklist that will be overwritten
    await setupInitialChecklist(page);
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Will Be Deleted");
    await page.getByRole("button", { name: "Save" }).click();

    await page.setInputFiles("input[type=file] >> nth=0", allChecklistsPath);

    const toast = page.getByRole("alert");
    await expect(toast).toContainText(
      /This will overwrite all current checklists/
    );
    await toast.getByRole("button", { name: "Confirm" }).click();

    await expect(
      page.locator(".saved-checklist-item", { hasText: "Will Be Deleted" })
    ).not.toBeVisible();
    await expect(
      page.locator(".saved-checklist-item", { hasText: "Imported Plan A" })
    ).toBeVisible();
    await expect(
      page.locator(".saved-checklist-item", { hasText: "Imported Plan B" })
    ).toBeVisible();
    await expect(page.locator(".saved-checklist-item")).toHaveCount(2);
  });
});
