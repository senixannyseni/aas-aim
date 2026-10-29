// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRef, type FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

/**
 * Regression tests for the reusable AIM presentation button.
 *
 * These tests exercise DOM behavior rather than calling the component as a
 * plain function. They do not establish permissions, engineering approvals,
 * or other authoritative domain rules.
 *
 * A per-file jsdom environment keeps the existing formatter tests on Node.
 */
afterEach(() => {
  cleanup();
});

describe("Button — rendering and visual variants", () => {
  it("renders an accessible native button with the supplied label", () => {
    render(<Button>Save draft</Button>);

    const button = screen.getByRole("button", { name: "Save draft" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toBe("Save draft");
    expect(button.classList.contains("aim-button")).toBe(true);
  });

  it("uses primary styling by default", () => {
    render(<Button>Open</Button>);

    expect(screen.getByRole("button").classList.contains("aim-button--primary")).toBe(true);
  });

  it("supports the secondary variant without changing semantics", () => {
    render(<Button variant="secondary">Cancel</Button>);

    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.classList.contains("aim-button--secondary")).toBe(true);
    expect(button.tagName).toBe("BUTTON");
  });

  it("preserves caller classes alongside AIM classes", () => {
    render(<Button className="local-action">Preview</Button>);

    const classes = screen.getByRole("button").classList;
    expect(classes.contains("aim-button")).toBe(true);
    expect(classes.contains("aim-button--primary")).toBe(true);
    expect(classes.contains("local-action")).toBe(true);
  });

  it("renders child content rather than restricting labels to strings", () => {
    render(
      <Button>
        <span>Review</span> <strong>evidence</strong>
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Review evidence" })).toBeDefined();
  });
});

describe("Button — clicks and form safety", () => {
  it("calls the supplied click handler once per activation", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Open record</Button>);

    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type=button and does not accidentally submit forms", () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button>Preview</Button>
      </form>,
    );

    const button = screen.getByRole("button");
    expect((button as HTMLButtonElement).type).toBe("button");
    button.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("supports explicit type=submit when requested", () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Submit draft</Button>
      </form>,
    );

    const button = screen.getByRole("button");
    expect((button as HTMLButtonElement).type).toBe("submit");
    button.click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("prevents activation when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    );

    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards ordinary HTML attributes and custom ARIA labels", () => {
    render(
      <Button
        id="create-action"
        name="action"
        value="create"
        title="Create a draft record"
        data-testid="create-button"
        aria-label="Create draft"
      >
        +
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Create draft" }) as HTMLButtonElement;
    expect(button.id).toBe("create-action");
    expect(button.name).toBe("action");
    expect(button.value).toBe("create");
    expect(button.title).toBe("Create a draft record");
    expect(button.getAttribute("data-testid")).toBe("create-button");
  });

  it("forwards a ref to the native button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Inspect</Button>);

    expect(ref.current).toBe(screen.getByRole("button", { name: "Inspect" }));
  });
});

describe("Button — loading and accessibility", () => {
  it("shows the loading spinner and screen-reader label", () => {
    const { container } = render(
      <Button isLoading loadingLabel="Saving draft">
        Save draft
      </Button>,
    );

    const button = screen.getByRole("button", { name: /Save draft.*Saving draft/ });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".aim-button__spinner")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".aim-sr-only")?.textContent).toContain("Saving draft");
  });

  it("disables native activation while loading, even when disabled=false", () => {
    const onClick = vi.fn();
    render(
      <Button isLoading disabled={false} onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("overrides an inconsistent aria-busy=false while loading", () => {
    render(
      <Button isLoading aria-busy="false">
        Save
      </Button>,
    );

    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
  });

  it("does not announce loading or render a spinner while idle", () => {
    const { container } = render(<Button>View</Button>);

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(container.querySelector(".aim-button__spinner")).toBeNull();
    expect(container.querySelector(".aim-sr-only")).toBeNull();
  });

  it("preserves a caller-supplied aria-busy value while idle", () => {
    render(<Button aria-busy="false">View</Button>);

    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("false");
  });

  it("recovers normal activation after a loading state ends", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button isLoading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button") as HTMLButtonElement;
    button.click();
    expect(onClick).not.toHaveBeenCalled();

    rerender(<Button onClick={onClick}>Save</Button>);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-busy")).toBeNull();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
