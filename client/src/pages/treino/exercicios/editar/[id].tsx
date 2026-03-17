"use client";

import { useEffect, useState } from "react";
import FormExercicioTreinos from "../../../../components/treinos/formExercicioTreinos.js";

export default function EditarExercicioTreinosPage() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const partes = window.location.pathname.split("/");
    const ultimo = partes[partes.length - 1];
    if (ultimo) setId(ultimo);
  }, []);

  if (!id) return null;

  return <FormExercicioTreinos exercicioId={id} />;
}