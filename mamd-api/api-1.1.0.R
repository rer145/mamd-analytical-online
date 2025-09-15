#* @filter cors
cors <- function(req, res) {
    #res$setHeader("Access-Control-Allow-Origin", "*")

    if (req$REQUEST_METHOD == "OPTIONS") {
        res$setHeader("Access-Control-Allow-Methods","*")
        res$setHeader("Access-Control-Allow-Headers", req$HTTP_ACCESS_CONTROL_REQUEST_HEADERS)
        res$status <- 200 
        return(list())
    } else {
        plumber::forward()
    }
}


#* Simple echo
#* @param msg The message to echo
#* @get /echo
function (msg = "") {
    list(msg = paste0("The message is: '", msg, "'"))
}



# create other endpoints to get plots, ctab, other analysis (load up by cookie of runtime?)
# how to create variable with multiple properties to display as json? 
# pull back individual items from ctab
# update openapi docs with full info


#* MaMD Analytical
#* @serializer unboxedJSON
#* @param group_list The list of groups to include
#* @param ANS ANS
#* @param INA INA
#* @param IOB IOB
#* @param MT MT
#* @param NAW NAW
#* @param NBC NBC
#* @param NO NO
#* @param PBD PBD
#* @param PZT PZT
#* @param ZS ZS
#* @get /mamd
function (res, group_list = "Unknown", ANS = NA, INA = NA, IOB = NA, MT = NA, NAW = NA, NBC = NA, NO = NA, PBD = NA, PZT = NA, ZS = NA) {

    # unique_analysis_id <- system("uuid", intern=T)
    # res$setCookie("unique_analysis_id", unique_analysis_id)

    res$setHeader("Access-Control-Allow-Origin", "*")

    suppressPackageStartupMessages(library("nnet"))
    suppressPackageStartupMessages(library("dplyr"))
    suppressPackageStartupMessages(library("caret"))
    suppressPackageStartupMessages(library("e1071"))
    suppressPackageStartupMessages(library("ModelMetrics"))
    suppressPackageStartupMessages(library("MLmetrics"))
    suppressPackageStartupMessages(library("textutils"))

    # if (ANS == -1) ANS <- NA
    # if (INA == -1) INA <- NA
    # if (IOB == -1) IOB <- NA
    # if (MT == -1) MT <- NA
    # if (NAW == -1) NAW <- NA
    # if (NBC == -1) NBC <- NA
    # if (NO == -1) NO <- NA
    # if (PBD == -1) PBD <- NA
    # if (PZT == -1) PZT <- NA
    # if (ZS == -1) ZS <- NA

    inputs_header <- c('Group', 'ANS', 'INA', 'IOB', 'MT', 'NAW', 'NBC', 'NO', 'PBD', 'PZT', 'ZS')
    inputs <- data.frame(
        group_list, 
        as.numeric(ANS),
        as.numeric(INA),
        as.numeric(IOB), 
        as.numeric(MT),
        as.numeric(NAW),
        as.numeric(NBC), 
        as.numeric(NO), 
        as.numeric(PBD),
        as.numeric(PZT),
        as.numeric(ZS),
        stringsAsFactors = TRUE)
    names(inputs) <- inputs_header

    MaMDR <- read.csv("/mamd.csv", sep=',', header=T)



    ################################################################################
    # get data from selected groups
    # this is radio buttons for the program, but for here:

    # convert groups input to vector
    selected_groups <- strsplit(group_list, split=",", fixed=TRUE)[[1]]

    #selected_groups <- 
    #c('AfrAm','EurAm')
    # c('AfrAm','Amerindian','AsAm','EurAm', 'SWHispanic')
    # c('AfrAm','AsAm','EurAm', 'SWHispanic')
    # c('AfrAm','EurAm', 'SWHispanic')
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
    #model1<-function(){
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
    #sensitivity<-ctab$byClass["Sensitivity"]
    #specificity<-ctab$byClass["Specificity"]
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

    sensitivity <- "0"
    specificity <- "0"

    tryCatch(
        {
            sensitivity <- trimws(gsub(paste("Class: ", trimws(aNNpred), sep=""), "", ctab$byClass[,"Sensitivity"][paste("Class: ", trimws(aNNpred), sep="")]))
        }
    )

    tryCatch(
        {
            specificity <- trimws(gsub(paste("Class: ", trimws(aNNpred), sep=""), "", ctab$byClass[,"Specificity"][paste("Class: ", trimws(aNNpred), sep="")]))
        }
    )
    ################################################################################

    list(
        #ctabByClass = ctab$byClass,
        #ctabOverall = ctab$overall,
        prediction = aNNpred,
        refGroup = RefGrpClassTbl,
        sensitivity = sensitivity,
        specificity = specificity,
        accuracy = ctab$overall["Accuracy"],
        accuracyLower = accuracyLower,
        accuracyUpper = accuracyUpper,
        posteriorProbability = max_probability,
        probabilities = probabilities,
        #matrix = matrix(c(1,2,3,4,5,6), nrow=2, ncol=3, byrow=TRUE),
        matrix = as.data.frame(ctab$table),
        matrixPercentages = as.data.frame(round(prop.table(ctab$table, 2),3)*100)
        #bestModel = fit.NN$bestTune[1,]
    )
}