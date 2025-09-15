FROM mamd-api-base
LABEL org.opencontainers.image.authors="Ron Richardson <ron.richardson@gmail.com>"

#COPY MaMD_1Jan2022_AnalData.csv /mamd.csv
COPY mamd-1.1.0.csv /mamd.csv
COPY api-1.1.0.R /api.R

CMD ["/app/plumber.R", "/api.R"]
