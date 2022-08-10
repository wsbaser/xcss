export default class Xcss{
    parse(xcssSelector) {
        if (!xcssSelector) {
            return null;
        }

        let combineWithRoot = false;
        let ROOT_PREFIX = 'root:';
        if (xcssSelector.startsWith(ROOT_PREFIX)) {
            combineWithRoot = true;
            xcssSelector = xcssSelector.replace(ROOT_PREFIX, '').trim();
        }

        let parts;
        let isCssStyle = true;
        try {
            parts = this.parseScss(xcssSelector);
        } catch (e) {
            console.log(e);
            // .hmm, not a valid scss, may be it is a regular css?
            if(this.isValidCss(xcssSelector)){
                isCssStyle = true;
                parts=this.parseCss(xcssSelector);
                this.validatePartsCssStyle(parts);
            }else{
                // .not a valid scss and not a valid css, consider selector is xpath
                isCssStyle = false;
                parts = this.parseXpath(xcssSelector);
                this.validatePartsXpathStyle(parts);
            }
        }

        let isValidCss = parts.every(p=>p.css);
        let css = isValidCss?parts.map(p=>p.css).join(''):null;
        let xpath = parts.map(p=>p.xpath).join('');

        return {
            combineWithRoot: combineWithRoot,
            scss: xcssSelector,
            css: css,
            xpath: xpath,
            parts: parts,
            isCssStyle: isCssStyle
        };
    }

    parseCss(cssSelector){
        let cssParts = this.splitScssToParts(cssSelector, ' ', '>', '+');
        let parts=[];
        let fullCss='';
        let startIndex=0;
        for (var i = 0; i < cssParts.length; i++) {
            let css = cssParts[i];
            fullCss+=css;

            try{
                let part = this.parseScssPart(css);
                part.fullCss = fullCss;
                part.fullScss = fullCss;
                part.startIndex = startIndex;
                parts.push(part);
            }
            catch(e){
                // .not a valid scss
                parts.push({
                    isXpath: false,
                    index: i,
                    scss: css,
                    css: css,
                    fullScss: fullCss,
                    fullCss: fullCss,
                    isCssStyle: true,
                    startIndex: startIndex
                });
            }
            startIndex += css.length;
        }
        return parts;
    }

    validatePartsCssStyle(parts){
        let hasInvalidParts = false;
        for (var i = 0; i<parts.length;  i++) {
            hasInvalidParts ^= !this.isValidCss(parts[i].fullCss);
            if(hasInvalidParts){
                parts[i].css='';
                parts[i].fullCss='';
            }
        };        
    }

    validatePartsXpathStyle(parts){
        let hasInvalidParts = false;
        for (var i = 0; i<parts.length;  i++) {
            hasInvalidParts ^= !this.isValidXpath(parts[i].fullXpath);
            if(hasInvalidParts){
                parts[i].xpath='';
                parts[i].fullXpath='';
            }
        };
    }

    parseXpath(xpathSelector){
        let hasRoot;
        if(xpathSelector.startsWith("//")){
            xpathSelector = this.cutLeadingString(xpathSelector,"//");
            hasRoot=true;
        }
        let xpathParts = this.splitScssToParts(xpathSelector, '/','//');
        let parts=[];
        let fullXpath='';
        let startIndex=0;
        for (var i = 0; i < xpathParts.length; i++) {
            let xpath = i==0 && hasRoot? "//"+xpathParts[i]: xpathParts[i];
            fullXpath+=xpath;
            parts.push({
                isXpath: true,
                index: i,
                scss: xpath,
                xpath: xpath,
                fullXpath: fullXpath,
                fullScss: fullXpath,
                isCssStyle: false,
                startIndex: startIndex
            });
            startIndex += xpath.length;
        }
        return parts;
    }

    isValidXpath(selector){
        try{
            document.evaluate(selector, document, null, XPathResult.ANY_TYPE, null);
            return true;
        }catch(e){
            return false;
        }
    }

    isValidCss(selector){
        try{
            document.querySelector(selector);
            return true;
        }catch(e){
            return false;
        }
    }

    IsNullOrWhiteSpace(input) {
        if (typeof input === 'undefined' || input == null) return true;
        return input.replace(/\s/g, '').length < 1;
    }

    splitScssToParts(scssSelector, ...delimiters) {
        let parts = [];
        let value = '';
        let readCondition = false;
        let readFunctionArgument = false;
        let conditionOpenBrackets =  { Count: 0 };
        scssSelector = scssSelector || '';

        let spaceIsDelimiter = delimiters.includes(' ');

        delimiters.sort((a,b)=>{return a.length<b.length?1:a.length>b.length?-1:0});

        while(scssSelector.length){
            let c = scssSelector[0];
            if (readCondition) {
                if (this.IsClosingConditionBracket(conditionOpenBrackets, c)) {
                    readCondition = false;
                }
            }
            else if (readFunctionArgument) {
                if (c == ')') {
                    readFunctionArgument = false;
                }
            }
            else{
                let delimiterWithSpaces = this.findDelimiter(scssSelector, delimiters, spaceIsDelimiter);
                if(delimiterWithSpaces){
                    c = delimiterWithSpaces;
                    if(value){
                        parts.push(value);
                        value='';
                    }
                }else if (c == '[') {
                    readCondition = true;
                }
                else if (c == '(') {
                    readFunctionArgument = true;
                }
            }
            value += c;
            scssSelector = scssSelector.slice(c.length);
        }
        if (!value
            || readCondition
            || readFunctionArgument) {
            throw "splitScssToParts: unexpected end of line";
        }
        parts.push(value);

        return parts;
    }

    findDelimiter(selector, delimiters, spaceIsDelimiter){
        let delimiterWithSpaces='';
        let trimmedSelector = selector.trimStart();
        let spacesBefore = selector.substring(0, selector.length - trimmedSelector.length);
        let delimiter = delimiters.find(d=>trimmedSelector.startsWith(d));
        if(delimiter){
            delimiterWithSpaces = spacesBefore + delimiter;
            let withoutDelimiter = selector.slice(delimiterWithSpaces.length);
            trimmedSelector = withoutDelimiter.trimStart();
            let spacesAfter = withoutDelimiter.substring(0, withoutDelimiter.length-trimmedSelector.length);
            delimiterWithSpaces+=spacesAfter;
        }else if(spaceIsDelimiter){
            delimiterWithSpaces = spacesBefore;
        }
        return delimiterWithSpaces;
    }

    IsClosingConditionBracket(conditionOpenBrackets, c) {
        if (c == '[')
            conditionOpenBrackets.Count++;
        else if (c == ']') {
            if (conditionOpenBrackets.Count == 0)
                return true;
            conditionOpenBrackets.Count--;
        }
        return false;
    }

    parseScss(scss, isInner) {
        let scssParts = this.splitScssToParts(scss, ' ', '>', '+', '<');
        let parts=[];
        let fullScss='';
        let fullCss='';
        let fullXpath=''
        let encounteredInvalidCss = false;
        let startIndex=0;
        for (let i = 0; i < scssParts.length; i++){
            let part = this.parseScssPart(scssParts[i]);
            part.index = i;
            if(i==0){
                if(isInner){
                    part.xpath = this.RemoveChildAxis(part.xpath);
                }else{
                    part.xpath = "//" + this.RemoveDescendantAxis(part.xpath);
                }
                // .css selector can not start with leading > or +
                if(!isInner && part.combinator.trim()){
                    encounteredInvalidCss=true;
                }
            }else{
                part.xpath = "/" + this.RemoveChildAxis(part.xpath);
            }

            // .so far we consider part.xpath to be always valid
            fullXpath+=part.xpath;
            part.fullXpath=fullXpath;

            // .when part.css can be invalid because it does not support some functions that xpath does
            // .we concatenate css only until we encounter invalid css selector
            if(part.css && !encounteredInvalidCss){
                fullCss+=part.css;
                part.fullCss=fullCss;
            }else{
                encounteredInvalidCss=true;
            }
            fullScss+=scssParts[i];
            part.fullScss=fullScss;

            part.startIndex = startIndex;
            startIndex+=scssParts[i].length;
            parts.push(part);
        }
        
        return parts;
    }

    cutLeadingString(text, toCut){
        return text.startsWith(toCut)?text.slice(toCut.length):text;
    }

    RemoveDescendantAxis(elementXpath)
    {
        return this.cutLeadingString(elementXpath, "descendant::");
    }

    RemoveChildAxis(elementXpath){
        return this.cutLeadingString(elementXpath,"child::");
    }

    parseScssPart(partScss) {
        const State = {
            Undefined: 0,
            ReadId: 10,
            ReadTag: 20,
            ReadClass: 30,
            ReadCondition: 40,
            ReadFunction: 50,
            ReadFunctionArgument: 60,
        };
        if (this.IsNullOrWhiteSpace(partScss)) {
            throw "Invalid scss: " + partScss;
        }        
        let combinator = this.findDelimiter(partScss, ['>', '+', '<'], true);
        if (combinator) {
            partScss = partScss.slice(combinator.length);
        }

        let tag = '';
        let id = '';
        let className = '';
        let condition = '';
        let func = '';
        let functionArgument = '';
        let classNames = [];
        let attributes = [];
        let conditions = [];
        let texts = [];
        let subelementXpaths = [];
        let state = State.ReadTag;
        let conditionOpenBrackets = { Count: 0 }; // количество открытых скобок [ внутри условия
        for (let i = 0; i < partScss.length; i++) {
            let c = partScss[i];
            if (state == State.ReadCondition
                && !this.IsClosingConditionBracket(conditionOpenBrackets, c)) {
                // внутри условия могут быть символы . # [ на которые нужно не обращать внимания
                condition += c;
                continue;
            }
            switch (c) {
                case '.':
                    switch (state) {
                        case State.ReadClass:
                            if (!className) {
                                throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                            }
                            classNames.push(className);
                            className = '';
                            break;
                        case State.ReadId:
                            if (!id){
                                throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                            }
                            break;
                        case State.ReadTag:
                        case State.Undefined:
                            break; // допустимые состояния
                        default:
                            throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                    }
                    state = State.ReadClass;
                    break;
                case '#':
                    if (id){
                        throw "two ids are illegal";
                    }
                    switch (state) {
                        case State.ReadClass:
                            if (!className){
                                throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                            }
                            classNames.push(className);
                            className = '';
                            break;
                        case State.ReadTag:
                        case State.Undefined:
                            break;
                        default:
                            throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                            break;
                    }
                    state = State.ReadId;
                    break;
                case '[':
                    switch (state) {
                        case State.ReadClass:
                            if (!className){
                                throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                            }
                            classNames.push(className);
                            className = '';
                            break;
                        case State.ReadId:
                            if (!id){
                                throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                            }
                            break;
                        case State.ReadTag:
                        case State.Undefined:
                            break; // допустимые состояния
                        default:
                            throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                    }

                    state = State.ReadCondition;
                    break;
                case ']':
                    if (state != State.ReadCondition){
                        throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                    }
                    if (this.IsText(condition)){
                        // текстовое условие
                        texts.push(condition);
                        // conditions.push(condition);
                    }else if (this.IsNumber(condition)
                        || this.IsFunction(condition)) {
                        conditions.push(condition);
                    } else {
                        let attribute = this.ParseAttribute(condition);
                        if (attribute != null) {
                            attributes.push(attribute);
                        } else {
                            // вложенный селектор
                            try {
                                let innerParts = this.parseScss(condition, true);
                                subelementXpaths.push(innerParts[innerParts.length-1].fullXpath);
                            } catch(e) {
                                conditions.push(condition);
                            }
                        }
                    }
                    condition = '';
                    state = State.Undefined;
                    break;
                case ':':
                    switch (state) {
                        case State.ReadFunction:
                        case State.ReadFunctionArgument:
                            throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                        default:
                            state = State.ReadFunction;
                            break;
                    }
                    break;
                case '(':
                    if (state != State.ReadFunction){
                        throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                    }
                    state = State.ReadFunctionArgument;
                    break;
                case ')':
                    if (state != State.ReadFunctionArgument){
                        throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                    }
                    state = State.Undefined;
                    break;
                default:
                    switch (state) {
                        case State.ReadId:
                            id += c;
                            break;
                        case State.ReadTag:
                            tag += c;
                            break;
                        case State.ReadClass:
                            className += c;
                            break;
                        case State.ReadCondition:
                            condition += c;
                            break;
                        case State.ReadFunction:
                            func += c;
                            break;
                        case State.ReadFunctionArgument:
                            functionArgument += c;
                            break;
                        case State.Undefined:
                            throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                            break;
                        default:
                            throw "incorrect symbol for state: "+state+", index: "+i+", scss: "+partScss+", case: '" + c + "'";
                    }
                    break;
            }
        }
        switch (state) {
            case State.Undefined:
            case State.ReadId:
            case State.ReadTag:
                break;
            case State.ReadClass:
                if (!className){
                    throw "incorrect symbol for state: state: "+state+", index: "+i+", scss: "+partScss+"}";
                }
                classNames.push(className);
                break;
//          case State.ReadCondition:
//              if (!className)
//                  throw "incorrect symbol for state: state: "+state+", index: "+i+", scss: "+partScss";
//              break;
            default:
                throw "incorrect symbol for state: state: "+state+", index: "+i+", scss: "+partScss+"}";
        }
        this.validate(tag, id, classNames, attributes, func, functionArgument);
        let isTrueCss = 
            texts.length==0 &&
            conditions.length == 0 &&
            subelementXpaths.length == 0 &&
            attributes.every(a => this.IsCssMatchStyle(a.matchStyle));
        if(!isTrueCss && this.isValidCss(partScss)){
            isTrueCss=true;
        }

        let normalizedCombinator = combinator.trim();
        let partXpath = this.aggregateToXpath(normalizedCombinator, tag, id, classNames, attributes, texts, conditions, subelementXpaths, func, functionArgument);
        let partCss = isTrueCss?combinator+partScss:undefined;

        texts = texts.map(t=>t[0] == '~' ? t.slice(2,t.length-1) : t.slice(1,t.length-1));

        return {
            combinator: combinator,
            tagName: tag,
            id: id,
            classNames: classNames,
            attributes: attributes,
            conditions: conditions,
            texts: texts,
            subelementXpaths: subelementXpaths,
            func: func,
            functionArgument: functionArgument,
            xpath: partXpath,
            css: partCss,
            scss: combinator + partScss,
            isCssStyle: true
        };
    }

    IsText(stringValue) {
        stringValue = (stringValue[0] == '~' || stringValue[0] == '*') ? stringValue.slice(1) : stringValue;
        return stringValue.length > 1 &&
               ((stringValue.startsWith("'") && stringValue.endsWith("'")) ||
                (stringValue.startsWith("\"") && stringValue.endsWith("\"")));
    }

    isSymbol(stringValue){
        return new RegExp("^[A-Za-z0-9_-]+$").test(stringValue);
    }

    IsNumber(condition) {
        return Number.isInteger(condition);
    }

    IsFunction(condition) {
        switch (condition) {
            case "last()":
                return true;
            default:
                return false;
        }
    }

    stripWrappingQuotes(text){
        return text.replace(/^('|")|('|")$/g, "");
    }

    ParseAttribute(condition) {
        let attributeMatchStyle = ['=','~'];
        for(let i=0; i<attributeMatchStyle.length; i++) {
            let arr = condition.split(attributeMatchStyle[i]);
            if ((arr.length == 2) && (this.IsText(arr[1]) || this.isSymbol(arr[1])))
                return {name: arr[0], value: this.stripWrappingQuotes(arr[1]), matchStyle: attributeMatchStyle[i]};
        }
        return null;
    }

    IsCssMatchStyle(matchStyle) {
        switch (matchStyle) {
            case '=':
                return true;
            default:
                return false;
        }
    }

    validate(tag, id, classNames, attributes, func, functionArgument) {
        if (tag) {
            this.ValidateIsElementName(tag);
        }
        if (id) {
            this.ValidateIsName(id);
        }
        for(let i=0; i<classNames.length; i++){
            this.ValidateIsIdent(classNames[i]);
        }
        for(let i=0; i<attributes.length; i++){
            this.ValidateIsIdent(attributes[i].name);
        }
        if (func) {
            this.ValidateIsCSSFunction(func, functionArgument);
        }
    }

    ValidateIsElementName(value) {
        if (!this.IsElementName(value)) {
            throw value + " is not element name";
        }
    }

    ValidateIsName(value) {
        if (!this.IsName(value)) {
            throw value + " is not name";
        }
    }

    ValidateIsIdent(value)
    {
        if (!this.IsIdent(value)) {
            throw value + " is not ident";
        }
    }

    ValidateIsCSSFunction(value, functionArgument) {
        switch (value) {
            case "contains":
                    this.ValidateIsContainsArgument(functionArgument);
                break;
            case "nth-child":
                    this.ValidateIsNthChildArgument(functionArgument);
                return;
            default:
                throw "'"+value+"' is not css function";
        }
    }

    ValidateIsContainsArgument(functionArgument) {
        if (!this.IsContainsArgument(functionArgument)) {
            throw "'"+functionArgument+"' is not valid argument for :contains function.";
        }
    }

    ValidateIsNthChildArgument(functionArgument) {
        if (!this.IsNthChildArgument(functionArgument)) {
            throw "'"+functionArgument+"' is not nth-child argument.";
        }
    }

    IsElementName(value) {
        // element_name : IDENT | '*'
        return value == "*" || this.IsIdent(value);
    }

    IsIdent(value) {
        let r = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/g.test(value);
        return r;
    }

    IsName(value) {
        let r = /^[_a-zA-Z0-9-]+$/g.test(value);
        return r;
    }

    IsContainsArgument(condition) {
        return /^'(?:.*)'$/g.test(condition);
    }

    IsNthChildArgument(condition) {
        let r = /^\d+(?:n(?:\+\d+)?)?$/g.test(condition);
        return r;
    }

    aggregateToXpath(axis, tag, id, classNames,
        attributes, texts, conditions, subelementXpaths, func, functionArgument)
    {
        tag = !tag ? "*" : tag;
        let xpath = this.XpathAxis(axis) + tag;
        if (id) {
            xpath += this.XpathAttributeCondition("id", id);
        }
        for (let i=0; i<classNames.length; i++) {
            xpath += this.XpathAttributeCondition("class", classNames[i], "~");
        }
        for (let i=0; i<attributes.length; i++) {
            xpath += this.XpathAttributeCondition(attributes[i].name, attributes[i].value, attributes[i].matchStyle);
        }
        for (let i=0; i<texts.length; i++)
        {
            xpath += this.XpathTextCondition(texts[i]);
        }
        for (let i=0; i<subelementXpaths.length; i++) {
            xpath += this.XpathCondition(subelementXpaths[i]);
        }
        for (let i=0; i<conditions.length; i++)
        {
            xpath += this.XpathCondition(conditions[i]);
        }
        if (func)
        {
            xpath += this.XpathFunction(func, functionArgument);
        }
        return xpath;
    }

    XpathFunction(func, functionArgument) {
        switch (func) {
            case "nth-child":
                return "["+functionArgument+"]";
            case "contains":
                return "[text()[contains(normalize-space(.),"+functionArgument+")]]";
            default:
                throw "ArgumentOutOfRangeException: function";
        }
    }

    XpathCondition(condition)
    {
        return "["+condition+"]";
    }

    XpathAxis(axis)
    {
        switch (axis)
        {
            case "":
            case " ":
                return "descendant::";
            case ">":
                return "child::";
            case "<":
                return "..//";
            case "+":
                return "following-sibling::";
            default:
                throw "argument out of range: axis";
        }
    }

    XpathAttributeCondition(name, value, style = '=')
    {
        value = "'" + value + "'";
        switch (style)
        {
            case '=':
                return "[@"+name+"="+value+"]";
            case '~':
                return "[contains(@"+name+","+value+")]";
            default:
                throw "argument out of range: style";
        }
    }

    XpathTextCondition(text)
    {
        if (text.startsWith("~") || text.startsWith("*") ) {
            return "[text()[contains(normalize-space(.),"+text.slice(1)+")]]";
        }
        let textWithNoQuotes = text.slice(1,text.length-1);
        // TODO: need tests for this change
        if (textWithNoQuotes.includes("'")) {
            text = "\"" + textWithNoQuotes + "\"";
        }
        return "[text()[normalize-space(.)="+text+"]]";
    }
}