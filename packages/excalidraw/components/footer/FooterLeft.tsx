import React from "react";

import { useTunnels } from "../../context/tunnels";

const FooterLeft = ({ children }: { children?: React.ReactNode }) => {
  const { FooterLeftTunnel } = useTunnels();

  return <FooterLeftTunnel.In>{children}</FooterLeftTunnel.In>;
};

export default FooterLeft;
FooterLeft.displayName = "FooterLeft";
