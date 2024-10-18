FROM mamd-api-base
LABEL org.opencontainers.image.authors="Ron Richardson <ron.richardson@gmail.com>"

#COPY MaMD_1Jan2022_AnalData.csv /mamd.csv
COPY mamd.csv /mamd.csv
COPY api.R /api.R

CMD ["/app/plumber.R", "/api.R"]
