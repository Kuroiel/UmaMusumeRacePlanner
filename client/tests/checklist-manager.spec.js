import { test, expect } from "@playwright/test";
import path from "path";

async function setupInitialChecklist(page) {
  await page.goto("/");

  const searchInput = page.getByPlaceholder("Search...");
  await searchInput.pressSequentially("Symboli Rudolf", { delay: 30 });
  await searchInput.press("Enter");

  await expect(searchInput).toHaveValue("Symboli Rudolf (Festival)");
  await expect(page.locator("tbody tr").first()).toBeVisible();

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

    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    const saveModal = page.getByRole("dialog", { name: "Save Checklist" });
    await expect(saveModal).toBeVisible();
    await saveModal.getByRole("textbox").fill(checklistName);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(saveModal).not.toBeVisible();
    await expect(page.getByText(checklistName)).toBeVisible();

    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.pressSequentially("Oguri Cap (Original)", { delay: 30 });
    await searchInput.press("Enter");
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );

    const savedItem = page.locator(".saved-checklist-item", {
      hasText: checklistName,
    });
    await savedItem.getByRole("button", { name: "Load" }).click();

    await expect(page.getByPlaceholder("Search...")).toHaveValue(
      /Symboli Rudolf/
    );
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (12)"
    );

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

    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(checklistName);
    await page.getByRole("button", { name: "Save" }).click();

    await page
      .locator("tr")
      .filter({ hasText: "Mile Championship" })
      .first()
      .getByRole("checkbox")
      .uncheck();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (11)"
    );

    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(checklistName);
    await page.getByRole("button", { name: "Save" }).click();

    const overwriteModal = page.getByRole("dialog", {
      name: "Overwrite Checklist",
    });
    await expect(overwriteModal).toBeVisible();
    await page.getByRole("button", { name: "Overwrite" }).click();
    await expect(overwriteModal).not.toBeVisible();

    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.pressSequentially("Oguri Cap (Original)", { delay: 30 });
    await searchInput.press("Enter");
    await page
      .locator(".saved-checklist-item")
      .getByRole("button", { name: "Load" })
      .click();

    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (11)"
    );
  });
});

test.describe("Checklist Manager: CRUD and Reordering", () => {
  test.beforeEach(async ({ page }) => {
    await setupInitialChecklist(page);
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Checklist Alpha");
    await page.getByRole("button", { name: "Save" }).click();

    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.pressSequentially("Oguri Cap (Original)", { delay: 30 });
    await searchInput.press("Enter");
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

    const zuluItem = page.locator(".saved-checklist-item", {
      hasText: "Checklist Zulu",
    });
    await zuluItem.getByRole("button", { name: "Move Up" }).click();
    await expect(checklists).toHaveText(["Checklist Zulu", "Checklist Alpha"]);

    await zuluItem.getByRole("button", { name: "Move Down" }).click();
    await expect(checklists).toHaveText(["Checklist Alpha", "Checklist Zulu"]);

    await page.getByRole("button", { name: "Sort by Name (A-Z)" }).click();
    await expect(checklists).toHaveText(["Checklist Alpha", "Checklist Zulu"]);

    await page.getByRole("button", { name: "Sort by Character" }).click();
    await expect(checklists).toHaveText(["Checklist Zulu", "Checklist Alpha"]);
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
    await setupInitialChecklist(page);
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
    await page
      .locator("input[type=file]")
      .nth(1)
      .setInputFiles(singleChecklistPath);

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
    await setupInitialChecklist(page);
    await page.getByRole("button", { name: "Save Current Checklist" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Will Be Deleted");
    await page.getByRole("button", { name: "Save" }).click();

    await page
      .locator("input[type=file]")
      .nth(0)
      .setInputFiles(allChecklistsPath);

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
