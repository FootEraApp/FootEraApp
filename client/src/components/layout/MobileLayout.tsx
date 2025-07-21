import React, { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

function MobileLayout({ children }: Props): JSX.Element {
  return (
    <div className="mobile-layout-wrapper">
      {children}
    </div>
  );
}

export default MobileLayout;
