import React from "react";

type Props = {
  children: React.ReactNode;
  hideNavigation?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
};

const MobileLayout: React.FC<Props> = ({
  children,
  hideNavigation = false,
  showBackButton = false,
  onBack
}) => {
  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {!hideNavigation && (
        <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
          <h1 className="text-lg font-bold">FootEra</h1>
          {showBackButton && (
            <button onClick={onBack} className="text-white">
              Voltar
            </button>
          )}
        </header>
      )}
      <main className="flex-1 p-4">{children}</main>
      <footer className="bg-gray-100 text-center text-xs p-2">
        &copy; {new Date().getFullYear()} FootEra
      </footer>
    </div>
  );
};

export default MobileLayout;
