import clsx from "clsx";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { useEditorInterface } from "../App";

const MenuTrigger = ({
  className = "",
  children,
  onClick,
  onToggle,
  title,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onToggle: () => void;
  title?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect" | "onToggle">) => {
  const editorInterface = useEditorInterface();
  const classNames = clsx(`dropdown-menu-button ${className}`, "zen-mode-transition", {
    "dropdown-menu-button--mobile": editorInterface.formFactor === "phone",
  }).trim();
  return (
    <DropdownMenuPrimitive.Trigger
      className={classNames}
      onClick={(event) => {
        onToggle();
        onClick?.(event);
      }}
      type="button"
      data-testid="dropdown-menu-button"
      title={title}
      {...rest}
    >
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "DropdownMenuTrigger";
