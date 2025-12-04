import { test, expect } from "@playwright/test";
import path from "path";

async function setupInitialChecklist(page) {
  await page.goto("/");

  const searchInput = page.getByPlaceholder("Search...");
  // OPTIMIZATION: Use fill instead of pressSequentially for speed and reliability
  await searchInput.fill("Symboli Rudolf");
  await searchInput.press("Enter");

  await expect(searchInput).toHaveValue("Symboli Rudolf (Festival)");
  await expect(page.locator("tbody tr").first()).toBeVisible();

  await page
    .locator("tr")
    .filter({ hasText: "Hopeful Stakes" })
    .first()
    .getByRole("checkbox")
    .check();
  await page
    .locator("tr")
    .filter({ hasText: "Osaka Hai" })
    .first()
    .getByRole("checkbox")
    .check();

  await expect(page.locator(".generate-button")).toContainText(
    "View Checklist (10)"
  );
}

// Helper to handle the "Switch Character" modal when optional races are present
async function handleCharacterSwitch(page) {
  const switchModal = page
    .locator(".modal-content")
    .filter({ hasText: "Switch Character" });
  await expect(switchModal).toBeVisible();
  await switchModal.getByRole("button", { name: "Reset Optional" }).click();
  await expect(switchModal).not.toBeVisible();
}

test.describe("Checklist Manager: Save, Load, and Overwrite", () => {
  test("should save a new checklist, clear the planner, and then load it", async ({
    page,
  }) => {
    await setupInitialChecklist(page);
    const checklistName = "Rudolf Triple Crown Plan";

    await page.getByRole("button", { name: "Save Current Checklist" }).click();

    const saveModal = page
      .locator(".modal-content")
      .filter({ hasText: "Save Checklist" });
    await expect(saveModal).toBeVisible();

    await saveModal.getByRole("textbox").fill(checklistName);
    // FIX: Scope to modal
    await saveModal.getByRole("button", { name: "Save" }).click();
    await expect(saveModal).not.toBeVisible();

    // FIX: Specific locator to verify list item visibility (avoids matching Toast)
    await expect(
      page.locator(".saved-checklist-item", { hasText: checklistName })
    ).toBeVisible();

    const searchInput = page.getByPlaceholder("Search...");
    // FIX: Use fill to overwrite previous value (Symboli Rudolf) and avoid timeout/appending
    await searchInput.fill("Oguri Cap (Original)");
    await searchInput.press("Enter");

    // Handle the modal that appears because optional races were selected
    await handleCharacterSwitch(page);

    // Oguri Cap has 5 career races (excluding Debut) on fresh select
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (5)"
    );

    const savedItem = page.locator(".saved-checklist-item", {
      hasText: checklistName,
    });
    await savedItem.getByRole("button", { name: "Load" }).click();

    await expect(page.getByPlaceholder("Search...")).toHaveValue(
      /Symboli Rudolf/
    );
    // Should return to 10 (8 Career + 2 Optional)
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (10)"
    );

    const osakaHaiRow = page
      .locator("tr")
      .filter({ hasText: "Osaka Hai" })
      .first();
    await expect(osakaHaiRow.getByRole("checkbox")).toBeChecked();
  });

  test("should prompt for overwrite when saving with an existing name", async ({
    page,
  }) => {
    await setupInitialChecklist(page);
    const checklistName = "Rudolf Overwrite Test";

    await page.getByRole("button", { name: "Save Current Checklist" }).click();

    const saveModal = page
      .locator(".modal-content")
      .filter({ hasText: "Save Checklist" });
    await expect(saveModal).toBeVisible();
    await saveModal.locator("input").fill(checklistName);
    // FIX: Scope to modal
    await saveModal.getByRole("button", { name: "Save" }).click();

    await page
      .locator("tr")
      .filter({ hasText: "Osaka Hai" })
      .first()
      .getByRole("checkbox")
      .uncheck();
    // 10 - 1 = 9
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );

    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await expect(saveModal).toBeVisible();
    await saveModal.locator("input").fill(checklistName);
    // FIX: Scope to modal
    await saveModal.getByRole("button", { name: "Save" }).click();

    const overwriteModal = page
      .locator(".modal-content")
      .filter({ hasText: "Overwrite Checklist" });
    await expect(overwriteModal).toBeVisible();
    // FIX: Scope to modal
    await overwriteModal.getByRole("button", { name: "Overwrite" }).click();
    await expect(overwriteModal).not.toBeVisible();

    const searchInput = page.getByPlaceholder("Search...");
    // FIX: Use fill
    await searchInput.fill("Oguri Cap (Original)");
    await searchInput.press("Enter");

    // Handle the modal that appears because optional races were selected
    await handleCharacterSwitch(page);

    await page
      .locator(".saved-checklist-item")
      .getByRole("button", { name: "Load" })
      .click();

    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );
  });
});

test.describe("Checklist Manager: CRUD and Reordering", () => {
  test.beforeEach(async ({ page }) => {
    await setupInitialChecklist(page);
    await page.getByRole("button", { name: "Save Current Checklist" }).click();

    const saveModal = page
      .locator(".modal-content")
      .filter({ hasText: "Save Checklist" });
    await saveModal.locator("input").fill("Checklist Alpha");
    await saveModal.getByRole("button", { name: "Save" }).click();

    const searchInput = page.getByPlaceholder("Search...");
    // FIX: Use fill
    await searchInput.fill("Oguri Cap (Original)");
    await searchInput.press("Enter");

    // Handle the modal that appears because optional races were selected
    await handleCharacterSwitch(page);

    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await saveModal.locator("input").fill("Checklist Zulu");
    await saveModal.getByRole("button", { name: "Save" }).click();
  });

  test("should rename a checklist", async ({ page }) => {
    const checklistItem = page.locator(".saved-checklist-item", {
      hasText: "Checklist Alpha",
    });
    await checklistItem.getByRole("button", { name: "Rename" }).click();

    const renameModal = page
      .locator(".modal-content")
      .filter({ hasText: "Rename Checklist" });
    await expect(renameModal).toBeVisible();
    const input = renameModal.getByRole("textbox");
    await expect(input).toHaveValue("Checklist Alpha");
    await input.fill("Checklist Bravo");
    // FIX: Scope to modal
    await renameModal.getByRole("button", { name: "Rename" }).click();

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

    const toast = page.locator(".confirmation-toast");
    await expect(toast).toContainText(
      /Delete checklist "Checklist Zulu"\? This cannot be undone./
    );
    await toast.getByRole("button", { name: "Confirm" }).click();

    await expect(checklistItem).not.toBeVisible();
  });

  test("should reorder and sort checklists", async ({ page }) => {
    const checklists = page.locator(".saved-checklist-item .checklist-name");

    // Default order: Alpha (created first), Zulu (created second)
    // Using Regex because the text includes character name e.g., "Checklist Alpha(Symboli Rudolf...)"
    await expect(checklists).toHaveText([/Checklist Alpha/, /Checklist Zulu/]);

    const zuluItem = page.locator(".saved-checklist-item", {
      hasText: "Checklist Zulu",
    });
    await zuluItem.getByRole("button", { name: "Move Up" }).click();
    await expect(checklists).toHaveText([/Checklist Zulu/, /Checklist Alpha/]);

    await zuluItem.getByRole("button", { name: "Move Down" }).click();
    await expect(checklists).toHaveText([/Checklist Alpha/, /Checklist Zulu/]);

    await page.getByRole("button", { name: "Sort by Name (A-Z)" }).click();
    await expect(checklists).toHaveText([/Checklist Alpha/, /Checklist Zulu/]);

    // Sorting by Character:
    // Alpha is Symboli Rudolf (S)
    // Zulu is Oguri Cap (O)
    // O comes before S -> Zulu, Alpha
    await page.getByRole("button", { name: "Sort by Character" }).click();
    await expect(checklists).toHaveText([/Checklist Zulu/, /Checklist Alpha/]);
  });

  test("should filter the list of saved checklists", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search checklists...");
    const checklistAlpha = page.locator(".saved-checklist-item", {
      hasText: "Checklist Alpha",
    });
    const checklistZulu = page.locator(".saved-checklist-item", {
      hasText: "Checklist Zulu",
    });

    await expect(checklistAlpha).toBeVisible();
    await expect(checklistZulu).toBeVisible();

    await searchInput.pressSequentially("Alpha", { delay: 30 });
    await expect(checklistAlpha).toBeVisible();
    await expect(checklistZulu).not.toBeVisible();

    await searchInput.fill("Oguri");
    await expect(checklistAlpha).not.toBeVisible();
    await expect(checklistZulu).toBeVisible();

    await searchInput.fill("");
    await expect(checklistAlpha).toBeVisible();
    await expect(checklistZulu).toBeVisible();
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

    const saveModal = page
      .locator(".modal-content")
      .filter({ hasText: "Save Checklist" });
    await saveModal.locator("input").fill("Export Me");
    // FIX: Scope to modal
    await saveModal.getByRole("button", { name: "Save" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page
      .locator(".saved-checklist-item", { hasText: "Export Me" })
      .getByRole("button", { name: "Export" })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Export Me.json");
  });

  test("should export all checklists", async ({ page }) => {
    await setupInitialChecklist(page);
    await page.getByRole("button", { name: "Save Current Checklist" }).click();

    const saveModal = page
      .locator(".modal-content")
      .filter({ hasText: "Save Checklist" });
    await saveModal.locator("input").fill("First");
    // FIX: Scope to modal
    await saveModal.getByRole("button", { name: "Save" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export All" }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      "umamusume-race-planner-all.json"
    );
  });

  test("should import a single checklist", async ({ page }) => {
    // FIX: Must navigate to the app before interacting with it
    await page.goto("/");
    await expect(page.getByPlaceholder("Search...")).toBeVisible();

    await page
      .locator("input[type=file]")
      .nth(1)
      .setInputFiles(singleChecklistPath);

    // FIX: Wait for success toast to ensure async file processing is done
    await expect(page.locator("div[role='status']")).toContainText(
      'Imported checklist "single-checklist"!'
    );

    const importedItem = page.locator(".saved-checklist-item", {
      hasText: "single-checklist",
    });
    await expect(importedItem).toBeVisible();

    await importedItem.getByRole("button", { name: "Load" }).click();
    await expect(page.getByPlaceholder("Search...")).toHaveValue(
      /Mejiro Dober/
    );
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (19)"
    );
  });

  test("should import all checklists and overwrite existing", async ({
    page,
  }) => {
    await setupInitialChecklist(page);
    await page.getByRole("button", { name: "Save Current Checklist" }).click();

    const saveModal = page
      .locator(".modal-content")
      .filter({ hasText: "Save Checklist" });
    await saveModal.locator("input").fill("Will Be Deleted");
    // FIX: Scope to modal
    await saveModal.getByRole("button", { name: "Save" }).click();

    await page
      .locator("input[type=file]")
      .nth(0)
      .setInputFiles(allChecklistsPath);

    const toast = page.locator(".confirmation-toast");
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
