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

    # convert groups input to vector
    groups <- strsplit(group_list, split=",", fixed=TRUE)[[1]]




    aNN_data <- read.csv("/mamd.csv")
    GroupCol <- 'Group'

    names(aNN_data)[names(aNN_data) == GroupCol] <- 'Group';

    # get data from selected groups
    aNN_data<-aNN_data[aNN_data$Group %in% unlist(strsplit(groups, split=',')),] %>% droplevels()
    aNN_data = aNN_data[,!sapply(inputs, function(x) mean(is.na(x)))>0.5]

    # apply same sapply to inputs to remove NA columns (or not pass in via original inputs file)
    aNN_data = na.omit(aNN_data)

    aNN_data$Group<-as.factor(aNN_data$Group)
    aNN_formula<-as.formula(Group ~ .)



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



    fit.NN <- train(
        Group ~ ., 
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
    ppbs <- predict(fit.NN, type = 'prob');

    # get predictions for training / reference data
    # for caret-NN
    mod <- predict(fit.NN, type="raw");
    mod <- as.factor(mod)

    # NOTE: switched in original! correct is confusionmatrix(PREDICTED, TRUE)
    #ctab<-caret::confusionMatrix(aNN_data$Group, mod)

    ctab<-caret::confusionMatrix(mod, aNN_data$Group)
    #ctab


    fit.NN$bestTune[1,]
    #RefGrpClassTbl <- cbind(aNN_data['MaMDID'],aNN_data['Group'], mod, ppbs);
    #names(RefGrpClassTbl)[names(RefGrpClassTbl) == 'mod'] <- 'Into';


    ############ Predict current case
    # type must be "prob" with caret-NN

    pred<-predict(fit.NN, newdata=inputs, type=c("prob"))
    # not needed with caret-NN
    # pred.post<-cbind(fit$xlevels, pred)
    pred.post<-as.data.frame(pred, row.names="Posterior Prob") ##Double check here, as this was changed
    pred.post$V1<-NULL
    pred.post<-format(round(pred,3), nsmall=3)
    #pred.post


    # Get label of predicted group membership
    aNNpred<-colnames(pred)[apply(pred, 1, which.max)]
    #aNNpred

    list(
        #ctabByClass = ctab$byClass,
        #ctabOverall = ctab$overall,
        prediction = aNNpred,
        sensitivity = trimws(gsub(paste("Class: ", trimws(aNNpred), sep=""), "", ctab$byClass[,"Sensitivity"][paste("Class: ", trimws(aNNpred), sep="")])),
        specificity = trimws(gsub(paste("Class: ", trimws(aNNpred), sep=""), "", ctab$byClass[,"Specificity"][paste("Class: ", trimws(aNNpred), sep="")])),
        # sensitivity = ctab$byClass["Sensitivity"],
        # specificity = ctab$byClass["Specificity"],
        accuracy = ctab$overall["Accuracy"],
        accuracyLower = ctab$overall["AccuracyLower"],
        accuracyUpper = ctab$overall["AccuracyUpper"],
        probabilities = round(pred,3),
        #matrix = matrix(c(1,2,3,4,5,6), nrow=2, ncol=3, byrow=TRUE),
        matrix = as.data.frame(ctab$table),
        matrixPercentages = as.data.frame(round(prop.table(ctab$table, 2),3)*100)
        #bestModel = fit.NN$bestTune[1,]
    )
}