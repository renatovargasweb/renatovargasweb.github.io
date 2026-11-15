# Builds assets/data/island.json for the home page.
#
# Reads (never writes) the sector tables of a sibling project and turns them
# into a small, anonymised input-output model: seven sectors, their mutual
# purchases, and what each unit of output costs in jobs, energy, water, CO2e.
# Figures are rounded to three significant digits and the economy is unnamed.
#
# Run by hand from the project root when the source changes:
#   Rscript data-raw/island.R

library(jsonlite)

src <- "../pan-ecirc/data/outputs"
rd <- function(f) as.data.frame(readRDS(file.path(src, paste0(f, ".rds"))))
sig <- function(x, d = 3) signif(x, d)

# Source name -> id, island name, one-line description
sectors <- data.frame(
  src = c("Agricultura y alimentos", "Industrias", "Ciudades y construcción",
          "Energía", "Recursos hídricos", "Residuos", "Resto de la economía"),
  id = c("farm", "works", "town", "power", "water", "waste", "port"),
  name = c("Farms & Food", "Industry", "Town & Construction",
           "Power", "Waterworks", "Salvage Yard", "Port & Services"),
  blurb = c("Fields, herds, fishing boats and the kitchens that process them.",
            "Factories, mills and plants that turn materials into goods.",
            "Housing, roads and everyone who builds them.",
            "Generation and the grid.",
            "Reservoirs, pipes and treatment.",
            "Collection, landfill and whatever gets recovered.",
            "Trade, transport, finance, government: everything else."),
  stringsAsFactors = FALSE
)
ord <- sectors$src
n <- length(ord)

# --- Inter-sector purchases (base year), rows sell, columns buy -------------
z <- rd("flujos_intersectoriales_mip2018")
Z <- as.matrix(z[match(ord, z$vende), ord])
Z <- sig(Z)

link <- rd("eslabonamientos_sector_mip2018")
link <- link[match(ord, link$sector_principal), ]
x <- sig(link$produccion_millones)

A <- sweep(Z, 2, x, "/")
L <- solve(diag(n) - A)

# --- Satellite accounts, per million of output ------------------------------
by_sector <- function(d, col, year) {
  d <- d[d$anio == year, ]
  d[[col]][match(ord, d$sector_principal)]
}
emis <- rd("intensidad_emisiones_sector")
ener <- rd("energia_sector_2018_2024")
agua <- rd("agua_uso_sector_2022")
cta  <- rd("cuentas_sector_2018_2024")
emp  <- rd("empleo_sector_2018_2024")

x_year <- function(y) by_sector(cta, "produccion", y)

coef <- list(
  va     = link$vab_millones / link$produccion_millones,
  jobs   = link$puestos / link$produccion_millones,
  co2    = by_sector(emis, "emisiones_gg", 2018) * 1000 / x_year(2018),  # t CO2e
  energy = by_sector(ener, "bep_miles", 2018) * 1000 / x_year(2018),     # barrels oil eq.
  water  = agua$millones_m3[match(ord, agua$sector_principal)] * 1000 / x_year(2022), # thousand m3
  import = link$coef_importacion
)
coef <- lapply(coef, sig)

# --- Seven-year series for the year dial ------------------------------------
years <- 2018:2024
series <- lapply(seq_len(n), function(i) {
  s <- ord[i]
  pick <- function(d, col) vapply(years, function(y) {
    v <- d[[col]][d$anio == y & d$sector_principal == s]
    if (length(v)) v else NA_real_
  }, numeric(1))
  list(
    va     = sig(pick(cta, "vab")),
    jobs   = sig(pick(emp, "puestos")),
    co2    = sig(pick(emis, "emisiones_gg")),
    energy = sig(pick(ener, "bep_miles"))
  )
})

waste <- rd("residuos_composicion_2021")
waste <- waste[order(-waste$fraccion), ]

out <- list(
  years = seq_along(years),
  sectors = lapply(seq_len(n), function(i) c(
    as.list(sectors[i, c("id", "name", "blurb")]),
    list(output = x[i]),
    lapply(coef, function(v) v[i]),
    list(ts = series[[i]])
  )),
  Z = unname(Z),
  L = unname(round(L, 5)),
  waste = list(
    material = c("Organics", "Other", "Plastic", "Paper & card", "Textiles",
                 "Metal", "Glass", "Wood", "E-waste", "Hazardous", "Rubber & leather"),
    share = waste$fraccion
  )
)
stopifnot(identical(waste$material[1:3], c("Orgánicos", "Otros", "Plástico")))

dir.create("assets/data", recursive = TRUE, showWarnings = FALSE)
write_json(out, "assets/data/island.json", auto_unbox = TRUE, digits = NA, na = "null")
cat("assets/data/island.json:", file.size("assets/data/island.json"), "bytes\n")
