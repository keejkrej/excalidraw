import React from "react";
import { vi } from "vitest";

import { DEFAULT_SIDEBAR, PRESENTATION_SIDEBAR_TAB } from "@excalidraw/common";

import { DefaultSidebar, Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render, screen, withExcalidrawDimensions } from "../tests/test-utils";

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
});
