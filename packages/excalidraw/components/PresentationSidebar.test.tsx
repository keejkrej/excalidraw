import React from "react";
import { vi } from "vitest";

import { DEFAULT_SIDEBAR, PRESENTATION_SIDEBAR_TAB } from "@excalidraw/common";

import { DefaultSidebar, Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { fireEvent, render, screen, withExcalidrawDimensions } from "../tests/test-utils";

vi.mock("../scene/export", () => ({
  exportToSvg: vi.fn(() => new Promise(() => {})),
}));

describe("PresentationSidebar", () => {
  it("renders the empty presentation state", async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: {
            openSidebar: {
              name: DEFAULT_SIDEBAR.name,
              tab: PRESENTATION_SIDEBAR_TAB,
            },
          },
        }}
      >
        <DefaultSidebar />
      </Excalidraw>,
    );

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(screen.getByText("Presentation")).toBeVisible();
      expect(screen.getByText("Slides (0)")).toBeVisible();
      expect(screen.getByRole("button", { name: "Create new slide" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Start presentation" })).toBeDisabled();
      expect(screen.queryAllByTestId("presentation-slide")).toHaveLength(0);
    });
  });

  it("renders slides using the themed list layout", async () => {
    const firstFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 40,
      width: 480,
      height: 270,
    });
    const secondFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 360,
      width: 480,
      height: 270,
    });

    await render(
      <Excalidraw
        initialData={{
          elements: [firstFrame, secondFrame],
          appState: {
            openSidebar: {
              name: DEFAULT_SIDEBAR.name,
              tab: PRESENTATION_SIDEBAR_TAB,
            },
          },
        }}
      >
        <DefaultSidebar />
      </Excalidraw>,
    );

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(screen.getByText("Slides (2)")).toBeVisible();
      expect(screen.getByRole("button", { name: "Start presentation" })).toBeEnabled();
      expect(screen.getAllByTestId("presentation-slide")).toHaveLength(2);
      expect(screen.getByText("Slide 1").closest(".PresentationSidebar__slide")).toHaveClass(
        "PresentationSidebar__slide--active",
      );
    });
  });

  it("opens the slide actions menu and duplicates a slide", async () => {
    const firstFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 40,
      width: 480,
      height: 270,
    });
    const secondFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 360,
      width: 480,
      height: 270,
    });

    await render(
      <Excalidraw
        initialData={{
          elements: [firstFrame, secondFrame],
          appState: {
            openSidebar: {
              name: DEFAULT_SIDEBAR.name,
              tab: PRESENTATION_SIDEBAR_TAB,
            },
          },
        }}
      >
        <DefaultSidebar />
      </Excalidraw>,
    );

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      fireEvent.click(screen.getByRole("button", { name: "Slide 1 actions" }));

      expect(await screen.findByText("Share presentation")).toBeVisible();
      expect(await screen.findByText("Export slide as")).toBeVisible();
      expect(await screen.findByText("Duplicate slide")).toBeVisible();
      expect(await screen.findByText("Rename slide")).toBeVisible();
      expect(await screen.findByText("Create new slide")).toBeVisible();
      expect(await screen.findByText("Remove slide")).toBeVisible();

      fireEvent.click(screen.getByText("Duplicate slide"));

      expect(screen.getAllByTestId("presentation-slide")).toHaveLength(3);
      expect(screen.getByText("Slides (3)")).toBeVisible();
    });
  });

  it("removes only the slide frame from the presentation", async () => {
    const firstFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 40,
      width: 480,
      height: 270,
    });
    const secondFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 360,
      width: 480,
      height: 270,
    });

    await render(
      <Excalidraw
        initialData={{
          elements: [firstFrame, secondFrame],
          appState: {
            openSidebar: {
              name: DEFAULT_SIDEBAR.name,
              tab: PRESENTATION_SIDEBAR_TAB,
            },
          },
        }}
      >
        <DefaultSidebar />
      </Excalidraw>,
    );

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      fireEvent.click(screen.getByRole("button", { name: "Slide 1 actions" }));
      fireEvent.click(await screen.findByText("Remove slide"));

      expect(screen.getAllByTestId("presentation-slide")).toHaveLength(1);
      expect(screen.getByText("Slides (1)")).toBeVisible();
    });
  });

  it("creates a new slide after the active slide from the header action", async () => {
    const firstFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 40,
      width: 480,
      height: 270,
    });
    const secondFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 360,
      width: 480,
      height: 270,
    });
    const thirdFrame = API.createElement({
      type: "frame",
      x: 40,
      y: 680,
      width: 480,
      height: 270,
    });

    await render(
      <Excalidraw
        initialData={{
          elements: [firstFrame, secondFrame, thirdFrame],
          appState: {
            openSidebar: {
              name: DEFAULT_SIDEBAR.name,
              tab: PRESENTATION_SIDEBAR_TAB,
            },
          },
        }}
      >
        <DefaultSidebar />
      </Excalidraw>,
    );

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      fireEvent.click(screen.getByText("Slide 2"));
      fireEvent.click(screen.getByRole("button", { name: "Create new slide" }));

      expect(screen.getAllByTestId("presentation-slide")).toHaveLength(4);
      expect(screen.getByText("Slides (4)")).toBeVisible();

      const slides = screen.getAllByTestId("presentation-slide");
      expect(slides[2]).toHaveClass("PresentationSidebar__slide--active");

      const createdFrame = API.getSelectedElement();
      expect(createdFrame.type).toBe("frame");
      expect(createdFrame.x).toBe(secondFrame.x);
      expect(createdFrame.y).toBe(secondFrame.y + secondFrame.height + 64);
      expect(createdFrame.width).toBe(secondFrame.width);
      expect(createdFrame.height).toBe(secondFrame.height);
    });
  });

  it("creates the first slide at the default presentation size", async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: {
            openSidebar: {
              name: DEFAULT_SIDEBAR.name,
              tab: PRESENTATION_SIDEBAR_TAB,
            },
          },
        }}
      >
        <DefaultSidebar />
      </Excalidraw>,
    );

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create new slide" }));

      expect(screen.getAllByTestId("presentation-slide")).toHaveLength(1);
      expect(screen.getByText("Slides (1)")).toBeVisible();

      const createdFrame = API.getSelectedElement();
      expect(createdFrame.type).toBe("frame");
      expect(createdFrame.x).toBe(0);
      expect(createdFrame.y).toBe(0);
      expect(createdFrame.width).toBe(1280);
      expect(createdFrame.height).toBe(720);
    });
  });
});
