# Haciendo cuadros de oferta y utilización
# Renato Vargas

# Clean environment
rm(list = ls())

# Load libraries
library(tidyverse)
library(gt)

# Load data
scnbio <- readRDS(file = "data/gtm/scnbio/gt-scn-bd-bio.rds")

# Oferta y Utilización compacta
scn_compacto <- scnbio |> 
  filter(
    Año == 2023
  ) |> 
  rename(
    `ID ATF` = `Áreas Transaccionales Filas No.`,
    ATF = `Áreas Transaccionales Filas Descripción`,
    `ID CPC` = `Código CPC`,
    CPC = `Elemento CPC`,
    `ID ATC` = `Área transaccional columnas No.`,
    ATC = `Área transaccional`
  ) |> 
  group_by(
    Cuadro,
    `ID ATF`,
    ATF,
    `ID CPC`,
    CPC,
    `ID ATC`,
    ATC
  ) |> 
  summarise(
    Valor = sum(Valor, na.rm = T),
    .groups = "drop_last"
  )


scn_pivot_compacto <- scn_compacto |> 
  pivot_wider(
    names_from = c(
      `ID ATC`,
      ATC
    ),
    values_from = Valor,
    names_sort = T,
    names_sep = " - ",
    values_fill = 0
  )

scn_pivot_compacto |> 
  gt()



#| label: tbl-vulnerabilidad-multiple
#| tbl-cap: "Número de personas vulnerables en múltiples dimensiones, por dominio"

tabla_multidimensional <- hogares_vulnerables |> 
  mutate(
    Dominio = as_factor(DOMINIO),
    personas = FACTOR07 * MIEPERHO,
    num_dimensiones = rowSums(
      across(starts_with("vulnerabilidad_")), na.rm = TRUE
    )
  ) |> 
  group_by(Dominio, num_dimensiones) |> 
  summarise(
    personas = sum(personas, na.rm = TRUE),
    .groups = "drop"
  ) |> 
  pivot_wider(
    names_from = num_dimensiones,
    names_prefix = "Dimensiones: ",
    values_from = personas,
    values_fill = 0
  ) |> 
  mutate(
    `Población total` = rowSums(
      across(starts_with("Dimensiones:")), na.rm = TRUE
    )
  ) |> 
  select(Dominio, `Población total`, everything())

tabla_multidimensional |> 
  gt() |> 
  fmt_number(
    columns = where(is.numeric),
    decimals = 0,
    use_seps = TRUE
  ) |> 
  grand_summary_rows(
    columns = where(is.numeric),
    fns = list(label = "Total", id = "totales", fn = "sum"),
    fmt = ~ fmt_number(., decimals = 0, use_seps = TRUE)
  )
