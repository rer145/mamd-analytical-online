###############################################################################
# TITLE: MaMD Analytical 1.1.0
# PURPOSE: redux
# LAST UPDATED ON 2023/02/25 (JTH)
# UPDATES: 
# 1. 2025/02/25:  redid code. using code from RR and SDO
# 2. 2025/02/25: corrected a number of issues in older code
# NOTES: 
################################################################################
# START WITH A CLEAN WORKING DIRECTORY
rm(list=ls())
################################################################################
# OPEN USEFUL LIBRARIES 
################################################################################
# load packages FIRST when local.
library("ModelMetrics")
library("MLmetrics")
library("nnet")
library("dplyr")
library("caret")
library("e1071")
################################################################################
#trim function output
trim <- function (x) gsub("^\\s+|\\s+$", "", x)
################################################################################
# load reference data 
data<-read.csv("mamd_data.csv", sep=',', header = T)
#rename
MaMDR<-data
################################################################################
# current case vars selected and scores
inputs <- read.csv("inputs.csv")
################################################################################
# get data from selected groups
# this is radio buttons for the program, but for here:
selected_groups <- 
# c('AfrAm','EurAm')
# c('AfrAm','Amerindian','AsAm','EurAm', 'SWHispanic')
# c('AfrAm','AsAm','EurAm', 'SWHispanic')
 c('AfrAm','EurAm', 'SWHispanic')
#Extract variable names from inputs where the user provided a value (i.e. non-missing)
#non_missing_inputs <- names(inputs)[-1][!is.na(inputs[1, -1])]
non_missing_inputs <- names(inputs)[!is.na(inputs[1, ])]
#Copy data for analysis
aNN_data <- MaMDR

# Determine which of these user-specified variables are available in aNN_data.
available_vars <- intersect(non_missing_inputs, names(aNN_data))

# Always include the outcome variable "Group".
selected_vars <- c(available_vars)

#Subset the training data to include only the selected variables.
aNN_data <- aNN_data[, selected_vars, drop = FALSE]
#Subset the training data to include only the selected groups
aNN_data <- aNN_data %>% 
  filter(Group %in% selected_groups)

# (Optional) Remove rows with any missing values.
aNN_data <- na.omit(aNN_data)

aNN_data$Group <- as.factor(aNN_data$Group)
aNN_formula <- as.formula("Group ~ .")
################################################################################
#downsample
# Determine the minimum group size
min_size <- aNN_data %>%
  group_by(Group) %>%
  summarise(count = n()) %>%
  summarise(min_count = min(count)) %>%
  pull(min_count)

# Downsample each group to the minimum group size
downsampled_MaMDR_Group <- aNN_data %>%
  group_by(Group) %>%
  sample_n(min_size) %>%
  ungroup()

downsampled_MaMDR_Group.1<-downsampled_MaMDR_Group
downsampled_MaMDR_Group<-downsampled_MaMDR_Group[,2:ncol(downsampled_MaMDR_Group)]
aNN_data<-downsampled_MaMDR_Group.1
################################################################################
# NN code with tunegrid and subsampling:
model1<-function(){
  suppressWarnings(ctrl  <- trainControl(method  = "cv",number  = 10, 
                      summaryFunction = multiClassSummary, # Multiple metrics
                      classProbs=T,# Required for the ROC curves
                      savePredictions = T, # Required for the ROC curves
                      ## new option here:
                      sampling = "down"))

  suppressWarnings(fit.NN <- train(aNN_formula, data = aNN_data, 
                method = "nnet", trace = F,
                trControl = ctrl, 
                preProcess = c("center","scale"), 
                maxit = 250,    # Maximum number of iterations
                tuneGrid = data.frame('size' = c(3,2,3,4,5,6,7,7,8,9), 
                                      'decay' = c(0.1,0,0,0,0.1,0.1,0.1,0,0,0)),
                 metric = "Accuracy"))
################################################################################
# f gives posterior probs for SOME of the reference data
suppressWarnings(f <- fitted(fit.NN)) # fitted.values
# this gives posterior probs for ALL of the reference data
ppbs <- predict(fit.NN, type = 'prob');
# get predictions for training / reference data
# for caret-NN
suppressWarnings(mod <- predict(fit.NN, type="raw"))
mod <- as.factor(mod)
#classification matrix (confusion matrix)
ctab<-caret::confusionMatrix(mod, aNN_data$Group)
accuracy<-ctab$overall["Accuracy"]
sensitivity<-ctab$byClass["Sensitivity"]
specificity<-ctab$byClass["Specificity"]
accuracyLower<-ctab$overall["AccuracyLower"]
accuracyUpper<-ctab$overall["AccuracyUpper"]
################################################################################
#more diagnostics and lists
paste('Best model:', '\n')
fit.NN$bestTune[1,]
RefGrpClassTbl <- cbind(aNN_data['Group'], mod, ppbs)
names(RefGrpClassTbl)[names(RefGrpClassTbl) == 'mod'] <- 'Into'
################################################################################
#RON, this is for the user imputed data
# predict current case from input file 
# type must be "prob" with caret-NN
suppressWarnings(pred<-predict(fit.NN, newdata=inputs, type=c("prob")))

# Get label of predicted group membership
aNNpred<-colnames(pred)[apply(pred, 1, which.max)]
# Extract the most likely ancestry and its probability
max_index <- which.max(pred)  # Find the index of the max value
max_ancestry <- colnames(pred)[max_index]  # Get the ancestry label
max_probability <- as.numeric(pred[max_index])  # Get the probability value
probabilities<-round(pred,3)
matrix<-ctab$table
matrixPercentages<-round(prop.table(ctab$table,1),3)*100
################################################################################
return(list(User.Inputs=inputs,Reference.Group.Class = RefGrpClassTbl, prediction=aNNpred,
            PosteriorProb=max_probability,OverallCorrect=accuracy, sensitivity=sensitivity, 
            specificity=specificity, accuracyLower=accuracyLower,accuracyUpper=accuracyUpper, 
            probabilities = probabilities, matrix=matrix, 
            matrixPercentages=matrixPercentages ))

}
model1()

