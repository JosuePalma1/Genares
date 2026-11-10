BEGIN;

GRANT SELECT ON TABLE
  public.versiones_rubrica_carreras,
  public.vigencias_rubrica_carrera
TO genares_9d_app;

COMMIT;
