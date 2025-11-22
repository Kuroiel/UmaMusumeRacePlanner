import { test, expect } from "@playwright/test";

test.describe("Initial Application Load", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the main header and title", async ({ page }) => {
    await expect(page).toHaveTitle("UmaMusume Race Planner");

    const mainHeader = page.getByRole("heading", {
      name: "UmaMusume Race Planner",
    });

    await expect(mainHeader).toBeVisible();
  });

  test("should display the initial state of key components", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search...");
    await expect(searchInput).toBeVisible();

    const checklistButton = page.getByRole("button", {
      name: /View Checklist/,
    });
    await expect(checklistButton).toBeVisible();
    await expect(checklistButton).toBeDisabled();
  });
});
