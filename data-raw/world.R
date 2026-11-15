# Builds assets/data/world.json for the map on the About page: one SVG path
# per country, from the public-domain Natural Earth 1:110m outlines.
#
# Run by hand from the project root (needs a connection):
#   Rscript data-raw/world.R

library(sf)
library(jsonlite)

src <- "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
w <- st_read(src, quiet = TRUE)
w <- w[w$ADM0_A3 != "ATA", ]

# Plain latitude-longitude on an 800-unit-wide sheet, cut at 84 N and 57 S.
W <- 800; TOP <- 84; BOTTOM <- -57
ring <- function(m) {
  x <- round((m[, 1] + 180) / 360 * W); y <- round((TOP - m[, 2]) / 360 * W)
  keep <- c(TRUE, diff(x) != 0 | diff(y) != 0)
  x <- x[keep]; y <- y[keep]
  if (length(x) < 4) return(NULL)   # collapsed to a speck at this scale
  # first point absolute, the rest as steps: shorter to write, same shape
  paste0("M", x[1], ",", y[1], "l", paste(diff(x), diff(y), sep = ",", collapse = " "), "z")
}
path <- function(g) {
  rings <- unlist(lapply(st_cast(st_sfc(g), "MULTIPOLYGON")[[1]], function(p) lapply(p, ring)))
  if (length(rings)) return(paste(rings, collapse = ""))
  # a country too small to survive rounding still gets a mark where it is
  b <- st_bbox(g); cx <- round((mean(b[c(1, 3)]) + 180) / 360 * W); cy <- round((TOP - mean(b[c(2, 4)])) / 360 * W)
  sprintf("M%d,%d %d,%d %d,%d %d,%dZ", cx - 1, cy - 1, cx + 1, cy - 1, cx + 1, cy + 1, cx - 1, cy + 1)
}
paths <- vapply(st_geometry(w), path, "")
names(paths) <- w$ADM0_A3

# every country the CV mentions must be on the map
used <- unique(unlist(strsplit(read.csv("data/cv/experience.csv")$countries, ";")))
stopifnot(all(used %in% names(paths)))

out <- list(w = W, h = round((TOP - BOTTOM) / 360 * W),
            names = as.list(setNames(w$NAME_LONG, w$ADM0_A3)), paths = as.list(paths))
write_json(out, "assets/data/world.json", auto_unbox = TRUE)
cat("assets/data/world.json:", file.size("assets/data/world.json"), "bytes,", length(paths), "countries\n")
