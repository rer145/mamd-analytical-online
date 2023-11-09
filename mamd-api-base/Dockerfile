FROM rstudio/plumber
LABEL org.opencontainers.image.authors="Ron Richardson <ron.richardson@gmail.com>"
MAINTAINER "Ron Richardson" ron.richardson@gmail.com

RUN R -e "install.packages('nnet')"
RUN R -e "install.packages('dplyr')"
RUN R -e "install.packages('caret')"
RUN R -e "install.packages('e1071')"
RUN R -e "install.packages('MLmetrics')"


# what about versioning the packages?
# also need to version rstudio/plumber to a specifc version of R

# RUN R -e "install.packages('remotes'); \
#   remotes::install_version('tidystringdist', '0.1.2')"