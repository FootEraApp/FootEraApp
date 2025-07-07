import { useEffect } from "react";
import { useLocation } from "wouter";

export default function HomeRedirect() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/login");
  }, []);

  return null;
}
