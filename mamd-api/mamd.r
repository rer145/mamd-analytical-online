trim <- function (x) gsub("^\\s+|\\s+$", "", x)

args <- commandArgs(trailingOnly = TRUE)
arg_groups <- trim(args[1])
arg_ANS <- trim(args[2])
arg_INA <- trim(args[3])
arg_IOB <- trim(args[4])
arg_MT <- trim(args[5])
arg_NAW <- trim(args[6])
arg_NBC <- trim(args[7])
arg_NO <- trim(args[8])
arg_PBD <- trim(args[9])
arg_PZT <- trim(args[10])
arg_ZS <- trim(args[11])
is_debug_mode <- as.logical(trim(args[12]))

debug_sep <- '------------------------------------------'

if (is_debug_mode) {
    #print(debug_sep)
    print("Arguments passed into script:")
    print(paste('Groups:', arg_groups, sep=" "))
    print(paste('ANS:', arg_ANS, sep=" "))
    print(paste('INA:', arg_INA, sep=" "))
    print(paste('IOB:', arg_IOB, sep=" "))
    print(paste('MT:', arg_MT, sep=" "))
    print(paste('NAW:', arg_NAW, sep=" "))
    print(paste('NBC:', arg_NBC, sep=" "))
    print(paste('NO:', arg_NO, sep=" "))
    print(paste('PBD:', arg_PBD, sep=" "))
    print(paste('PZT:', arg_PZT, sep=" "))
    print(paste('ZS:', arg_ZS, sep=" "))
    #print(debug_sep)
}




if (is_debug_mode) {
    print('Building input file...')
}

inputs_header <- c('Group', 'ANS', 'INA', 'IOB', 'MT', 'NAW', 'NBC', 'NO', 'PBD', 'PZT', 'ZS')
inputs <- data.frame(
    arg_groups, 
    as.numeric(arg_ANS), 
    as.numeric(arg_INA),
    as.numeric(arg_IOB), 
    as.numeric(arg_MT),
    as.numeric(arg_NAW),
    as.numeric(arg_NBC), 
    as.numeric(arg_NO), 
    as.numeric(arg_PBD),
    as.numeric(arg_PZT),
    as.numeric(arg_ZS),
    stringsAsFactors = TRUE)
names(inputs) <- inputs_header

# convert groups input to vector
groups <- strsplit(arg_groups, split=",", fixed=TRUE)[[1]]

if (is_debug_mode) {
    print('Generated input file:')
    print(inputs)
}




if (is_debug_mode) {
    print('Loading up packages...')
}

suppressPackageStartupMessages(library("nnet"))
suppressPackageStartupMessages(library("dplyr"))
suppressPackageStartupMessages(library("caret"))
suppressPackageStartupMessages(library("e1071"))
suppressPackageStartupMessages(library("MLmetrics"))


if (is_debug_mode) {
    print('Loading and prepping reference file...')
}

aNN_data <- read.csv("/analysis/mamd.csv")
GroupCol <- 'Ancestry'

# rename GroupCol -- group column -- for analysis
names(aNN_data)[names(aNN_data) == GroupCol] <- 'Group';

# get data from selected groups
aNN_data<-aNN_data[aNN_data$Group %in% unlist(strsplit(groups, split=',')),] %>% droplevels()
aNN_data = aNN_data[,!sapply(inputs, function(x) mean(is.na(x)))>0.5]

# apply same sapply to inputs to remove NA columns (or not pass in via original inputs file)
aNN_data = na.omit(aNN_data)

aNN_data$Group<-as.factor(aNN_data$Group)
aNN_formula<-as.formula(Group ~ .)




if (is_debug_mode) {
    print('Beginning NNet analysis...')
}

# NN code with tunegrid and subsampling:

if (is_debug_mode) print('  trainControl')
ctrl <- trainControl(
    method = "cv",
    number = 10, 
    summaryFunction = multiClassSummary, # Multiple metrics
    classProbs = T, # Required for the ROC curves
    savePredictions = T, # Required for the ROC curves
    ## new option here:
    sampling = "down");

# For replication 
# (I've added the same in all "trains" so you can just run that part independently)
set.seed(150) 


# Find best model params 
# using full suite of traits 

if (is_debug_mode) print('  train')
fit.NN <- train(
    Group ~ ANS+ INA+ IOB+ MT+ NAW+ NBC+ NO+ PBD+ PZT+ ZS, 
    data = aNN_data, 
    method = "nnet", 
    trace = F,
    trControl = ctrl, 
    preProcess = c("center","scale"), 
    maxit = 250,    # Maximum number of iterations
    tuneGrid = data.frame('size' = c(3,2,3,4,5,6,7,7,8,9), 'decay' = c(0.1,0,0,0,0.1,0.1,0.1,0,0,0)),
    # tuneGrid = data.frame(size = 0, decay = 0),skip=TRUE, # Technically, this is log-reg
    metric = "Accuracy");



# f gives posterior probs for SOME of the reference data
f <- fitted(fit.NN); # fitted.values

# this gives posterior probs for ALL of the reference data
if (is_debug_mode) print('  predict posterior probabilities')
ppbs <- predict(fit.NN, type = 'prob');

# get predictions for training / reference data
# for caret-NN
if (is_debug_mode) print('  predict training/reference data')
mod <- predict(fit.NN, type="raw");
mod <- as.factor(mod)

# NOTE: switched in original! correct is confusionmatrix(PREDICTED, TRUE)
#ctab<-caret::confusionMatrix(aNN_data$Group, mod)

if (is_debug_mode) print('  confusionMatrix')
ctab<-caret::confusionMatrix(mod, aNN_data$Group)




#cat("CORRECTED Table for", GroupCol, '\n');
#cat(capture.output(inputs), sep = '\n');
ctab











############ more diagnostics and lists
if (is_debug_mode) print('  Best Model')
fit.NN$bestTune[1,]
RefGrpClassTbl <- cbind(aNN_data['MaMDID'],aNN_data['Group'], mod, ppbs);
names(RefGrpClassTbl)[names(RefGrpClassTbl) == 'mod'] <- 'Into';


############ Predict current case
# type must be "prob" with caret-NN

if (is_debug_mode) print('  Predicting current case')
pred<-predict(fit.NN, newdata=inputs, type=c("prob"))
# not needed with caret-NN
# pred.post<-cbind(fit$xlevels, pred)
pred.post<-as.data.frame(pred, row.names="Posterior Prob") ##Double check here, as this was changed
pred.post$V1<-NULL
pred.post<-format(round(pred,3), nsmall=3)
pred.post


if (is_debug_mode) print('  Getting predicted group membership')
# Get label of predicted group membership
aNNpred<-colnames(pred)[apply(pred, 1, which.max)]
aNNpred

quit()