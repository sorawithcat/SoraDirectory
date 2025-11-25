/**
 * 中途不需要传入的参数用undefined代替。
 * 如要传第1,3个参数，那么第二个参数就传入undefined
 * 如fun(a,b,c){};
 * fun(a,undefined,c)
 * 
 * 如果不需要传入的参数在后面，且之后没有需要传入的参数，不传参即可，无需输入undefined
 * 如fun(a,b,c){};
 * fun(a,b)
 */

/**
 * 求和函数。传入任意的数字返回求和之后的数字。
 * */
function numSum() {
    let sum = 0
    for (let i = 0; i < arguments.length; i++) {
        sum += arguments[i]
    }
    return sum
}

/**
 * 将数组求和
 * @param {any} arr - 任意一个数组，默认返回0
 */
function arrSum(arr = []) {
    let sum = 0
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i]
    }
    return sum
}

/**
 * 将数组由大到小排
 * @param {any} arr - 任意一个数组，默认为空数组
 */
function maxToMin(arr = []) {
    for (let i = 0; i < arr.length - 1; i++) {
        for (let y = i + 1; y < arr.length; y++) {
            let team
            if (arr[y] > arr[i]) {
                team = arr[i]
                arr[i] = arr[y]
                arr[y] = team
            }
        }
    }
    return arr
}

/**
 * 将数组由小到大排
 * @param {any} arr - 任意一个数组，默认为空数组
 */
function minToMax(arr = []) {
    for (let i = 0; i < arr.length - 1; i++) {
        for (let y = i + 1; y < arr.length; y++) {
            let team
            if (arr[y] < arr[i]) {
                team = arr[i]
                arr[i] = arr[y]
                arr[y] = team
            }
        }
    }
    return arr
}

/**
 * 这是一个用来打印文本的函数
 * @param {number} numb - 0:打印在控制台 1：打印到页面上 2：alert 3.prompt，默认为0
 * @param {any} consoles - 想要打印的内容，默认为空。
 */
function prints(numb = 0, ...consoles) {
    //0:打印在控制台 1：打印到页面上 2：alert 3.prompt
    switch (numb) {
        case 0: console.log(...consoles)
            break;
        case 1: document.write(...consoles)
            break;
        case 2: alert(...consoles)
            break;
        case 3: prompt(...consoles)
            break;
        default: console.log(...consoles)
            break;
    }
}

/**
 * 创建一个div在指定的id里，成功返回新id名，失败返回false
 * @param {any} creatadds - 指定的id，新的div将创建在它之里，必填项
 * @param {any} idname - 给予新的div的id，默认为空
 * @param {any} classname - 给予新的div的类名，默认为空
 */
function creatDivById(creatadds = "", idname = "", classname = "") {
    let ids = document.getElementById(creatadds)
    if (ids) {
        let div = document.createElement("div")
        div.setAttribute("id", idname)
        div.setAttribute("class", classname)
        ids.appendChild(div)
        return idname
    } else {
        console.log(`找不到此id："${creatadds}"`)
        return false
    }
}

/**
 * 创建一个div在指定的id后，成功返回新id名，失败返回false
 * @param {any} creatadds - 指定的id，新的div将创建在它之后，必填项
 * @param {any} idname - 给予新的div的id，默认为空
 * @param {any} classname - 给予新的div的类名，默认为空
 */
function creatDivByIdBefore(creatadds = "", idname = "", classname = "") {
    let ids = document.getElementById(creatadds)
    if (ids) {
        let div = document.createElement("div")
        div.setAttribute("id", idname)
        div.setAttribute("class", classname)
        ids.after(div);
        return idname
    } else {
        console.log(`找不到此id："${creatadds}"`)
        return false
    }
}

/**
 * 创建一个div在指定的类名后，成功返回新id名，失败返回false
 * @param {any} creatadds - 指定的类名，新的div将创建在它之后，必填项
 * @param {any} idname - 给予新的div的id，默认为空
 * @param {any} classname - 给予新的div的类名，默认为空
 * @param {any} creataddsxiaobiao - 指定类名的下标，默认为0
 */
function creatDivByClassBefore(creatadds = "", idname = "", classname = "", creataddsxiaobiao = 0) {
    let classnames = document.getElementsByClassName(creatadds)[creataddsxiaobiao]
    let classnameslenth = document.getElementsByClassName(creatadds).length
    if (classnames) {
        let div = document.createElement("div");
        div.setAttribute("id", idname);
        div.setAttribute("class", classname);
        classnames.after(div);
        return idname
    } else {
        if (creataddsxiaobiao > classnameslenth - 1 && classnameslenth) {
            console.error(`找不到指定的下标：${creataddsxiaobiao}.最大下标为${classnameslenth - 1}`);
        } else {
            console.error(`找不到指定的类名：${creatadds}`);
        }
        return false
    }
}

/**
 * 创建一个div在指定的类名里，成功返回新id名，失败返回false
 * @param {any} creatadds - 指定的类名，新的div将创建在它之里，必填项
 * @param {any} idname - 给予新的div的id，默认为空
 * @param {any} classname - 给予新的div的类名，默认为空
 * @param {any} creataddsxiaobiao - 指定类名的下标，默认为0
 */
function creatDivByClass(creatadds = "", idname = "", classname = "", creataddsxiaobiao = 0) {
    let classnames = document.getElementsByClassName(creatadds)[creataddsxiaobiao]
    let classnameslenth = document.getElementsByClassName(creatadds).length
    if (classnames) {
        let div = document.createElement("div");
        div.setAttribute("id", idname);
        div.setAttribute("class", classname);
        classnames.appendChild(div)
        return idname
    } else {
        if (creataddsxiaobiao > classnameslenth - 1 && classnameslenth) {
            console.error(`找不到指定的下标：${creataddsxiaobiao}.最大下标为${classnameslenth - 1}`);
        } else {
            console.error(`找不到指定的类名：${creatadds}`);
        }
        return false
    }
}

/**
 * 创建一个div在指定的标签里，成功返回新id名，失败返回false
 * @param {any} creatadds - 指定的标签，新的div将创建在它之里，默认为body
 * @param {any} idname - 给予新的div的id，默认为空
 * @param {any} classname - 给予新的div的类名，默认为空
 * @param {any} creataddsxiaobiao - 指定的标签的下标，默认为0
 */
function creatDivByTagName(creatadds = "body", idname = "", classname = "", creataddsxiaobiao = 0) {
    let tags = document.getElementsByTagName(creatadds)[creataddsxiaobiao]
    let tagslenth = document.getElementsByTagName(creatadds).length
    if (tags) {
        let div = document.createElement("div")
        div.setAttribute("id", idname)
        div.setAttribute("class", classname)
        tags.appendChild(div)
        return idname
    }
    else {
        if (creataddsxiaobiao > tagslenth - 1 && tagslenth) {
            console.error(`找不到指定的下标：${creataddsxiaobiao}.最大下标为${tagslenth - 1}`);
        } else {
            console.error(`找不到指定的标签：${creatadds}`);
        }
        return false
    }
}

/**
 * 获取一定区间内的整数，会判断区间的范围，左大右小会将范围替换为左小右大
 * @param {number} min - 最小值，默认为0
 * @param {number} max - 最大值，默认为10
 */
function getInt(min = 0, max = 10) {
    let mid
    if (min > max) {
        mid = min
        min = max
        max = mid
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 获取一定区间内的小数，会判断区间的范围，左大右小会将范围替换为左小右大，末尾为0会省略
 * @param {number} min - 最小值，默认为0
 * @param {number} max - 最大值，默认为10
 * @param {number} weishu - 小数位数，默认为2，最大为14
 */
function getDouble(min = 0, max = 10, weishu = 2) {
    let mid
    if (min > max) {
        mid = min
        min = max
        max = mid
    }
    if (weishu > 14) {
        weishu = 14
    }
    numb = Math.random() * (max - min) + min + ""
    let numbers = +(numb.slice(0, numb.indexOf('.') + 1) + numb.slice(numb.indexOf('.') + 1, weishu + numb.indexOf('.') + 1))
    return numbers;
}

/**
 * 将RGB转换为十六进制的形式，返回字符串类型。当传入一个或多个长度为3的数组时，仅用最后一个数组赋值。传入不规范数组将使用前三个数或者0传参。无法识别的将返回false。
 * @param {number} red - 红，默认为0
 * @param {number} green - 绿，默认为0
 * @param {number} blue - 蓝，默认为0
 */
function rgbToHexadecimal(red = 0, green = 0, blue = 0) {
    var arr = [red, green, blue]
    let fuzhi = arr
    if (isHTMLElement(red) || isHTMLElement(green) || isHTMLElement(blue)) {
        console.log(`你输入了一个错误的参数：${fuzhi}`)
        return false
    }

    if (typeof (red) == "string" || typeof (green) == "string" || typeof (blue) == "string") {
        arr = (red + "," + green + "," + blue).split(",")
    }
    let arr1 = red
    let arr2 = green
    let arr3 = blue

    if ((Array.isArray(red) && arr1.length == 3) || (Array.isArray(green) && arr2.length == 3) || (Array.isArray(blue) && arr3.length == 3)) {
        if (Array.isArray(red) && arr1.length == 3) {
            red = +arr1[0]
            green = +arr1[1]
            blue = +arr1[2]
        }
        if (Array.isArray(green) && arr2.length == 3) {
            red = +arr2[0]
            green = +arr2[1]
            blue = +arr2[2]
        }
        if (Array.isArray(blue) && arr3.length == 3) {
            red = +arr3[0]
            green = +arr3[1]
            blue = +arr3[2]
        }
    } else {
        arr = arr.join(",").split(",")
        arr = [+arr[0], +arr[1], +arr[2]]
        if (!Object.is(arr[2], NaN)) {
            red = arr[0]
            green = arr[1]
            blue = arr[2]
        } else if (!Object.is(arr[1], NaN)) {
            red = arr[0]
            green = arr[1]
            blue = 0
        } else if (!Object.is(arr[0], NaN)) {
            red = arr[0]
            green = 0
            blue = 0
        } else {
            red = 0
            green = 0
            blue = 0
        }
        console.log(`你传入了${fuzhi},已使用${[red, green, blue]}代替`)
    }
    if (Object.is(red, NaN)) {
        red = 0
        console.log(`你传入了${fuzhi},已使用${[red, green, blue]}代替`)

    }
    if (Object.is(green, NaN)) {
        green = 0
        console.log(`你传入了${fuzhi},已使用${[red, green, blue]}代替`)

    }
    if (Object.is(blue, NaN)) {
        blue = 0
        console.log(`你传入了${fuzhi},已使用${[red, green, blue]}代替`)

    }

    if (red > 255) {
        console.log("红色数据大于255，已用255代替")
        red = 255
    } else if (red < 0) {
        console.log("红色数据小于0，已用0代替")
        red = 0
    }
    let reds = red.toString(16)
    if (reds.length == 1) {
        reds = `0${reds}`
    }
    if (green > 255) {
        console.log("绿色数据大于255，已用255代替")
        green = 255
    } else if (green < 0) {
        console.log("绿色数据小于0，已用0代替")
        green = 0
    }
    let greens = green.toString(16)
    if (greens.length == 1) {
        greens = `0${greens}`
    }
    if (blue > 255) {
        console.log("蓝色数据大于255，已用255代替")
        blue = 255
    } else if (blue < 0) {
        console.log("蓝色数据小于0，已用0代替")
        blue = 0
    }
    let blues = blue.toString(16)
    if (blues.length == 1) {
        blues = `0${blues}`
    }
    let hex = `#${reds}${greens}${blues}`
    return hex
}

/**
 * 将十六进制转换为RGB,返回一个数组，数组元素从左至右分别为红，绿，蓝。
 * @param {string} hexadecimal - 颜色-十六进制，默认为"#000000"。需传入无误的十六进制，否则会在末尾加0补齐（过短）/截取一段重新传参（过长）/智能修改传参（传参格式错误，注：字符、字母、空格不会被修改）/返回false（其他错误）
 */
function hexadecimalToRgb(hexadecimal = "#000000") {
    let oldname = hexadecimal
    if (isHTMLElement(hexadecimal)) {
        hexadecimal = "#000000";
        console.log(`你输入了一个错误的十六进制：${oldname}。已用${hexadecimal}代替。`)
    }
    if (hexadecimal == undefined) {
        hexadecimal = "#000000"
        console.log(`你输入了一个错误的十六进制：${oldname}。已用${hexadecimal}代替。`)
    }
    if (Array.isArray(hexadecimal)) {
        hexadecimal = hexadecimal.join("")
        console.log(`你输入了一个数组：${oldname}。已用${hexadecimal}代替。`)
    }
    if (typeof (hexadecimal) == "number") {
        hexadecimal = "#" + hexadecimal
    }
    if (isNaN(hexadecimal)) {
        if (hexadecimal.startsWith("#") != true) {
            if (hexadecimal.indexOf("#") >= 0) {
                let arr1 = hexadecimal.split("")
                while (arr1.indexOf("#") >= 0) {
                    arr1.splice(arr1.indexOf("#"), 1)
                }
                arr1 = arr1.join("")
                hexadecimal = "#" + arr1
                console.log(`你输入了一个错误的十六进制：${oldname}。已用${hexadecimal}代替。`)
            } else {
                if (checkNumberInStr(hexadecimal)) {
                    hexadecimal = "#" + hexadecimal
                    console.log(`你输入了一个错误的十六进制：${oldname}。已用${hexadecimal}代替。`)
                } else {
                    return false
                }
            }
        }
    } else {
        hexadecimal = "#" + hexadecimal
    }
    if (hexadecimal.length > 7) {
        let hexs = hexadecimal.slice(0, 7)
        console.log(`你貌似传输了一个错误的参数：${hexadecimal}，已用${hexs}来代替。`)
        hexadecimal = hexs
    }
    if (hexadecimal.length < 7) {
        let xiaoshu = ""
        for (let i = 0; i < 7 - hexadecimal.length; i++) {
            xiaoshu = xiaoshu + "0"
        }
        let hexss = hexadecimal
        hexadecimal = hexadecimal + xiaoshu
        console.log(`你貌似传输了一个省略的参数：${hexss}，已用${hexadecimal}来代替。`)
    }
    let bcolorred = parseInt(hexadecimal.substring(1, 3), 16)
    let bcolorgreen = parseInt(hexadecimal.substring(3, 5), 16)
    let bcolorblue = parseInt(hexadecimal.substring(5, 7), 16)
    let rgb = [bcolorred, bcolorgreen, bcolorblue]
    if (Object.is(rgb[0], NaN) || Object.is(rgb[1], NaN) || Object.is(rgb[2], NaN)) {
        console.log(`你输入了一个错误的十六进制：${hexadecimal}。`)
        return false
    }
    return rgb
}

/**
 * 返回一个随机颜色，以数组形式返回
 * @returns {Array}
 */
function getRgbColor() {
    let color = [getInt(0, 255), getInt(0, 255), getInt(0, 255)]
    return color
}

/**
 * 返回一个随机颜色，以字符串形式返回一个十六进制形式的颜色
 * @returns {string}
 */
function getHexadecimalColor() {
    let color = rgbToHexadecimal(getInt(0, 255), getInt(0, 255), getInt(0, 255))
    return color
}

/**
 * 打乱一个数组，返回数组类型
 * @param {arr} arr - 任意数组，默认为空数组
 */
function mixArr(arr = []) {
    let team
    let suijishu
    for (let i = 0; i < arr.length; i++) {
        suijishu = getInt(0, arr.length - 1)
        suijishu1 = getInt(0, arr.length - 1)
        team = arr[suijishu]
        arr[suijishu] = arr[suijishu1]
        arr[suijishu1] = team
    }
    return arr
}

/**
 * 对纯字符串数组按首字母和长度由大到小进行排序，返回数组类型
 * @param {string[]} arr - 任意数组，默认为[""]
 */
function maxToMinStr(arr = [""]) {
    let team
    for (let i = 0; i < arr.length; i++) {
        for (let y = i; y < arr.length; y++) {
            if (arr[y].slice(0, 1) > arr[i].slice(0, 1)) {
                team = arr[i]
                arr[i] = arr[y]
                arr[y] = team
            }
        }
    }
    for (let i = 0; i < arr.length; i++) {
        for (let y = i; y < arr.length; y++) {
            //比较长度，长度大的放前面
            if (arr[y].length > arr[i].length) {
                team = arr[i]
                arr[i] = arr[y]
                arr[y] = team
            }

        }
    }
    return arr
}

/**
 * 对纯字符串数组按字母由大到小进行排序，返回数组类型
 * @param {string[]} arr - 任意数组，默认为[""]
 */
function maxToMinStred(arr = [""]) {
    arr.sort(function (b, a) {
        // 按照每个字符的顺序进行比较
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            // 按照字符的Unicode编码进行比较
            if (a[i].charCodeAt() !== b[i].charCodeAt()) {
                return a[i].charCodeAt() - b[i].charCodeAt();
            }
        }
        // 长度不同的字符串，短的排在前面
        return a.length - b.length;
    });
    return arr;
}

/**
 * 对纯字符串数组按首字母和长度由小到大进行排序，返回数组类型
 * @param {string[]} arr - 任意数组，默认为[""]
 */
function minToMaxStr(arr = [""]) {
    let team

    for (let i = 0; i < arr.length; i++) {
        for (let y = i; y < arr.length; y++) {
            if (arr[y].slice(0, 1) < arr[i].slice(0, 1)) {
                team = arr[i]
                arr[i] = arr[y]
                arr[y] = team
            }
        }
    }
    for (let i = 0; i < arr.length; i++) {
        for (let y = i; y < arr.length; y++) {
            //比较长度，长度大的放后面
            if (arr[y].length < arr[i].length) {
                team = arr[i]
                arr[i] = arr[y]
                arr[y] = team
            }

        }
    }
    return arr
}

/**
 * 对纯字符串数组按字母由小到大进行排序，返回数组类型
 * @param {string[]} arr - 任意数组，默认为[""]
 */
function minToMaxStred(arr = [""]) {
    // 过滤掉 null、undefined 和非字符串值
    arr = arr.filter(item => item != null && typeof item === 'string');
    
    arr.sort(function (a, b) {
        // 确保 a 和 b 都是字符串
        if (typeof a !== 'string') a = String(a || '');
        if (typeof b !== 'string') b = String(b || '');
        
        // 按照每个字符的顺序进行比较
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            // 按照字符的Unicode编码进行比较
            if (a[i].charCodeAt() !== b[i].charCodeAt()) {
                return a[i].charCodeAt() - b[i].charCodeAt();
            }
        }
        // 长度不同的字符串，短的排在前面
        return a.length - b.length;
    });
    return arr;
}

/**
 * 返回页面内所有id，返回类型为数组 
 */
function allId() {
    let chucunid = []
    let ids = document.getElementsByTagName("*")
    for (let i = 0, j = 0; i < ids.length; i++) {
        if (ids[i].id) {
            chucunid[j] = ids[i].id
            j++
        }
    }
    return chucunid
}

/**
 * 检查是否存在此id，返回id下标或者布尔值。当参数fanhui值为0时，如果不存在，则以数组形式返回最接近的两个id。
 * @param {string} idname - id名
 * @param {number} fanhui - 0为返回id下标或者以数组形式返回最接近的两个id，其他数字为返回true或flase。默认为0.
 * @param {number} findway - 寻找方式，默认为0，其他数字为按首字母和长度查询（不推荐）
 */
function checkid(idname, fanhui = 0, findway = 0) {
    // 如果 idname 为 null 或 undefined，直接返回 false
    if (idname == null || idname === undefined) {
        if (fanhui == 0) {
            return false;
        } else {
            return false;
        }
    }
    
    let ids = allId()
    if (ids.indexOf(idname) >= 0) {
        console.log(`存在此id名："${idname}"`)
        if (fanhui == 0) {
            return ids.indexOf(idname)
        } else {
            return true
        }
    } else {
        ids[ids.length] = idname
        if (findway == 0) {
            ids = minToMaxStred(ids)
        } else {
            ids = minToMaxStr(ids)
        }
        if (ids.indexOf(idname) + 1 == ids.length) {
            console.log(`不存在此id名："${idname}"，最接近的id名有："${ids[ids.indexOf(idname) - 1]}"，"${ids[ids.indexOf(idname) - 2]}"`)
            if (fanhui == 0) {
                return [ids[ids.indexOf(idname) - 1], ids[ids.indexOf(idname) - 2]]
            } else {
                return false
            }
        } else if (ids.indexOf(idname) == 0) {
            console.log(`不存在此id名："${idname}"，最接近的id名有："${ids[ids.indexOf(idname) + 1]}"，"${ids[ids.indexOf(idname) + 2]}"`)
            if (fanhui == 0) {
                return [ids[ids.indexOf(idname) + 1], ids[ids.indexOf(idname) + 2]]
            } else {
                return false
            }
        } else {
            console.log(`不存在此id名："${idname}"，最接近的id名有："${ids[ids.indexOf(idname) - 1]}"，"${ids[ids.indexOf(idname) + 1]}"`)
            if (fanhui == 0) {
                return [ids[ids.indexOf(idname) - 1], ids[ids.indexOf(idname) + 1]]
            } else {
                return false
            }
        }
    }
}

/**
 * 修改指定id的id和类名，成功返回true，不成功以数组形式返回最接近的两个id
 * @param {string} idname - 旧id
 * @param {string} newidname - 新id，默认为""
 * @param {string} newclassname - 新类名,默认为""，多类名用逗号隔开
 * @param {number} fangshi - 修改类名的方式，0为覆盖，其他数字为增加，默认为0
 */
function changeById(idname, newidname = "", newclassname = "", fangshi = 0) {
    let idnames = document.getElementById(`${idname}`)
    if (idnames) {
        if (newidname != "") {
            idnames.id = newidname
        }
        if (fangshi == 0) {
            idnames.className = newclassname
        } else {
            idnames.className += (` ${newclassname}`)
        }
        return true
    } else {
        let lastname = checkid(idname)
        return lastname
    }
}

/**
 * 修改指定类名下标的id和类名，返回布尔值
 * @param {string} classname - 旧类名
 * @param {number} xiabiao - 旧类名的下标，默认为0
 * @param {string} newidname - 新id,默认为原id
 * @param {string} newclassname - 新类名,默认为""，多类名用逗号隔开
 * @param {number} fangshi - 修改类名的方式，0为覆盖，其他数字为增加，默认为0
 */
function changeByClassName(classname, xiabiao = 0, newidname = "", newclassname = "", fangshi = 0) {
    let classnames = document.getElementsByClassName(`${classname}`)
    if (classnames) {
        if (xiabiao >= classnames.length || xiabiao < 0) {
            console.log(`你输入的下标有误：${xiabiao}，此类名的下标范围为: 0 - ${classnames.length - 1}`)
            return false
        } else {
            if (newclassname == "") {
                newclassname = classname
            }
            if (newidname != "") {
                classnames[xiabiao].id = newidname
            }
            if (fangshi == 0) {
                classnames[xiabiao].className = newclassname
            } else {
                classnames[xiabiao].className += (` ${newclassname}`)
            }
            return true
        }
    } else {
        console.log(`未找到指定类名:${classname}`)
        return false
    }
}

/**
 * 修改指定标签下标的id和类名，返回布尔值
 * @param {string} tagname - 标签名,默认为"*"
 * @param {number} xiabiao - 标签的下标，默认为0
 * @param {string} newidname - 新id,默认为原id
 * @param {string} newclassname - 新类名,默认为""
 * @param {number} fangshi - 修改类名的方式，0为覆盖，其他数字为增加，默认为0
 */
function changeByTagName(tagname = "*", xiabiao = 0, newidname, newclassname = "", fangshi = 0) {
    let tagnames = document.getElementsByTagName(`${tagname}`)
    if (tagnames) {
        if (xiabiao >= tagnames.length || xiabiao < 0) {
            console.log(`你输入的下标有误：${xiabiao}，此标签的下标范围为: 0 - ${tagnames.length - 1}`)
            return false
        } else {
            if (newclassname == "") {
                newclassname = classname
            }
            if (newidname != "") {
                tagnames[xiabiao].id = newidname
            }
            if (fangshi == 0) {
                tagnames[xiabiao].className = newclassname
            } else {
                tagnames[xiabiao].className += (` ${newclassname}`)
            }
            return true
        }
    } else {
        console.log(`未找到指定标签:${tagname}`)
        return false
    }
}

/**
 * 返回页面重复的id，如果无重复，返回true，如果有重复，返回一个二维数组，格式为[[重复的id名,下标···]]
 * @returns {arr[] | boolean}
 * */
function setId() {
    let allIds = allId()
    let duplicates = {}; // 用对象来存储重复的id及其下标

    for (let i = 0; i < allIds.length; i++) {
        let currentId = allIds[i];

        if (duplicates[currentId] === undefined) {
            duplicates[currentId] = [i]; // 第一次出现的id，直接添加下标
        } else {
            duplicates[currentId].push(i); // 已经存在的id，将下标添加到已存的数组中
        }
    }
    // 将重复的id及其下标转换为二维数组
    let result = Object.entries(duplicates).filter(entry => entry[1].length > 1).map(entry => [entry[0], ...entry[1]]);
    if (result == "") {
        return true
    } else {
        return result;
    }
}

/**
 * 得到一个不重复的id名
 * @param {number} idlength - id名的长度，默认为6
 * @param {number} isUpper - 是否全部大写/小写。0为随机大小写（首字母小写），1为全部大写，2为全部小写。默认为0.
 */
function getOneId(idlength = 6, isUpper = 0) {
    if (isUpper >= 3) {
        isUpper = 2
    }
    if (isUpper < 0) {
        isUpper = 0
    }
    while (1) {
        let zumu = "abcdefghijklmnopqrstuvwxyz".split("")
        let allids = allId()
        let zumnu
        let suijishu
        let xiabiao = 0
        let idname = []
        for (let i = 0; i < idlength; i++) {
            xiabiao = getInt(0, zumu.length)
            suijishu = getInt(1, 3)
            if (isUpper == 0) {
                if (i == 0) {
                    suijishu = 2
                }
                if (suijishu == 1) {
                    while (typeof (zumu[xiabiao]) == String) {
                        zumnu = zumu[xiabiao].toUpperCase()
                    }
                    idname[i] = zumnu
                } else {
                    zumnu = zumu[xiabiao]
                    idname[i] = zumnu
                }
            } else if (isUpper == 1) {
                while (typeof (zumu[xiabiao]) == String) {
                    zumnu = zumu[xiabiao].toUpperCase()
                }
                idname[i] = zumnu
            } else if (isUpper == 2) {
                zumnu = zumu[xiabiao]
                idname[i] = zumnu
            }
        }
        let idnames = idname.join("")
        if (allids.indexOf(idnames) == -1) {
            return idnames
        }
    }
}

/**
 * 逐字打印内容，执行结束返回true。
 * @param {any} strings - 任意内容，多组内容（非数字）用加号（+）连接，如需打印如123+123，请用引号括起来。
 * @param {number} printtime - 打印速度，单位：毫秒。默认1字/秒。输入不规范的数字或输入字符串将转为默认值。
 * @param {number} printway - 0:打印在控制台 1：打印到页面上 2：alert 3.prompt 4.打印到指定id上。默认为0。
 * @param {any} idname - 指定id名（如果printway的值为4.则需要填写此项，否则不需要填写此项），默认为""，如果没找到则返回false，并在控制台打印最相近的id。
 * @param {any} tagname - 内容的标签（如果printway的值为4.则可以填写此项，否则不需要填写此项），默认为""
 * @param {any} newidname - 内容的标签的id（如果printway的值为4.则可以填写此项，否则不需要填写此项），默认为""
 * @param {any} newclassname - 内容的标签的类名（如果printway的值为4.则可以填写此项，否则不需要填写此项），默认为""
 */
function charPrint(strings = "", printtime = 1000, printway = 0, idname = "", tagname = "", newidname = "", newclassname = "") {
    let arr
    if (printtime < 0 || (typeof (printtime) != "number")) {
        printtime = 1000
    }
    if (typeof (strings) == "string") {
        arr = strings.split("")
    } else if (typeof (strings) == "object") {
        arr = (strings.join(",")).split("")
    } else {
        arr = `${strings}`.split("")
    }
    let i = 0
    let jishiqi
    if (printway == 4) {
        var idnames = document.getElementById(`${idname}`)
        if (idnames) {
            if (tagname != "") {
                let tagnames = document.createElement(`${tagname}`)
                idnames.appendChild(tagnames)
                idnames.style.wordWrap = "break-word"
                if (newidname != "") {
                    tagnames.id = newidname
                }
                if (newclassname != "" && tagnames.className != "") {
                    tagnames.className += (` ${newclassname}`)
                }
                else {
                    tagnames.className += (`${newclassname}`)
                }
                jishiqi = setInterval(() => {
                    if (i >= arr.length) {
                        clearInterval(jishiqi)
                        return true
                    }
                    tagnames.innerHTML += arr[i]
                    i++;
                }, printtime);
            } else {
                jishiqi = setInterval(() => {
                    if (i >= arr.length) {
                        clearInterval(jishiqi)
                        return true
                    }
                    idnames.innerHTML += arr[i]
                    i++;
                }, printtime);
            }

        } else {
            checkid(idname)
            return false
        }
    } else {
        jishiqi = setInterval(() => {
            if (i >= arr.length - 1) {
                clearInterval(jishiqi)
                return true
            }
            prints(printway, arr[i])
            i++;
        }, printtime);
    }

}

/**
 * 修改指定id的标签,传入的标签名或者链接不规范/id名字错误返回false
 * @param {any} idname - 指定id
 * @param {any} tagname - 修改的标签名，默认为"div"
 * @param {string} adds - 如果是a标签或者img标签，需要填入路径（https或者http开头），默认为"#"
 * @param {any} inner - 如果是a标签或者img标签，可以填入文本，默认与adds相同（注：a标签必须填此项，不填则与adds相同）
 */
function changeTagById(idname, tagname = "div", adds = "#", inner = adds) {
    let as = ((adds + "").startsWith("http://") || (adds + "").startsWith("https://"))

    if (typeof (tagname) != "string" || as == false) {
        console.log("传入的标签名或者链接不规范，如无误，请确定链接是否以https://或者http://开头")
        return false
    }
    if (tagname == "") {
        tagname = "div"
    }
    let idnames = document.getElementById(`${idname}`)
    let tagnames = document.createElement(`${tagname}`)
    if (idnames) {
        tagnames.setAttribute("id", idname + "1")
        let idnamesss = idname + "1"
        tagnames.setAttribute("class", idnames.className)
        idnames.after(tagnames)
        let newidname = document.getElementById(`${idnamesss}`)
        let lenthsss = idnames.children.length
        for (let i = 0; i < lenthsss; i++) {
            newidname.append(idnames.children[0])
        }
        newidname.setAttribute("id", idname)
        idnames.remove()
        if (tagname == "a") {
            newidname.href = adds
            if (inner == "") {
                newidname.innerHTML = adds
            }
            newidname.innerHTML = inner
        }
        if (tagname == "img") {
            newidname.setAttribute("src", adds)
            newidname.title = inner
        }
        return true
    } else {
        checkid(`${idname}`)
        return false
    }
}

/**
 * 得到一个颜色，string类型，十六进制形式
 * @returns {string} - 一个"#000000"格式的字符串
 * */
function getColor() {
    return rgbToHexadecimal(getInt(0, 255), getInt(0, 255), getInt(0, 255))
}

/**
 * 检测字符串里是否有数字
 * @param {any} str - 字符串,默认为""
 */
function checkNumberInStr(str = "") {
    let bo = false
    for (var i = 0; i < 10; i++) {
        if (str.indexOf(i) == -1) {
            bo = true;
            break;
        }
    }
    return bo;
}

/**
 * 判断是否是dom（有误差）
 * @param {any} element
 */
function isHTMLElement(element) {
    return typeof element === 'object' && element !== null && element.nodeType === 1;
}

/**
 * 得到给定时间的总秒数。可传入一个数组或者分别传入值。
 * @param {any} hour - 小时，默认为0
 * @param {any} min - 分钟，默认为0
 * @param {any} sec - 秒，默认为0
 */
function getTimeSec(hour = 0, min = 0, sec = 0) {
    if (Array.isArray(hour)) {
        let arr = hour
        hour = arr[0]
        min = arr[1]
        sec = arr[2]
    }
    let sum = 0
    sum = parseInt(hour * 60 * 60 + min * 60 + sec)
    return sum
}

/**
 * 得到给定秒数有几时几分几秒。返回数组。
 * @param {any} sec - 总秒数，默认为0
 * @param {number} returnway - 返回方式。0：[时，分，秒]。1：[天，时，分，秒]。默认为0。其他数字转为0.
 */
function getTimeAll(sec = 0, returnway = 0) {
    if (returnway < 0 || returnway > 1) {
        returnway = 0
    }
    let d = parseInt(sec / 60 / 60 / 24)
    let h = parseInt(sec / 60 / 60 % 24)
    if (returnway == 0) {
        h = h + d * 24
    }
    let m = parseInt(sec / 60 % 60)
    let s = parseInt(sec % 60)

    switch (returnway) {
        case 0: return [h, m, s]
        case 1: return [d, h, m, s]
    }
}

/**
 * 清除字符串中的数字
 * @param {any} str - 任意字符串
 */
function clearNumbInStr(str = "") {
    str = str.replace(/[0-9]/g, "")
    return str
}

/**
 * 清除字符串中的字符
 * @param {any} str - 任意字符串
 * @param {any} clearway - 0：仅清除字符；其他数字：清除特殊字符和字符。默认为0.
 */
function clearCharInStr(str = "", clearway = 0) {
    str = str.replace(/[a-z]/ig, "")
    if (clearway != 0) {
        str = str.replace(/[!-\/]/g, "")
        str = str.replace(/[:-@]/g, "")
        str = str.replace(/[\\-`/]/g, "")
        str = str.replace(/[{-~]/g, "")
    }
    return str
}

/////////////////////////////////////////////////////////////////////////////////***************************************要改
/**
 * 将指定id元素X方向移动
 * @param {any} idname - 指定元素的id
 * @param {any} path - 移动的距离，默认为0。正为右移，负为左移。
 * @param {number} time - 每移动1px所需的单位。1单位约为4毫秒。默认为10单位。传入0时将恢复默认值。
 * @param {boolean} fast - 是否立即移动。默认为false。
 */
function moveX(idname = "", path = 0, time = 10, fast = false) {
    if (time <= 0) {
        time = Math.abs(time)
        if (time == 0) {
            time = 10
        }
    }
    const idnames = document.getElementById(`${idname}`)
    if (idnames) {
        if (!fast) {
            let jishiqi
            let longth = 0
            if (path >= 0) {
                jishiqi = setInterval(function () {
                    if (longth < Math.abs(path)) {
                        longth += 0.5;
                        idnames.style.transform += `translateX(0.5px)`
                    } else {
                        clearInterval(jishiqi)
                    }
                }, time / 2);
            } else {
                jishiqi = setInterval(function () {
                    if (longth < Math.abs(path)) {
                        longth += 0.5;
                        idnames.style.transform += `translateX(-0.5px)`
                    } else {
                        clearInterval(jishiqi)
                    }
                }, time / 2);
            }
            return true
        } else {
            idnames.style.transform += `translateX(${path}px)`
            return true
        }
    } else {
        checkid(idname)
        return false
    }
}

/**
 * 将指定id元素Y方向移动
 * @param {any} idname - 指定元素的id
 * @param {any} path - 移动的距离，默认为0。正为上移，负为下移。
 * @param {number} time - 每移动1px所需的单位。1单位约为4毫秒。默认为10单位。传入0时将恢复默认值。
 * @param {boolean} fast - 是否立即移动。默认为false。
 */
function moveY(idname = "", path = 0, time = 10, fast = false) {
    if (time <= 0) {
        time = Math.abs(time)
        if (time == 0) {
            time = 10
        }
    }
    const idnames = document.getElementById(`${idname}`)
    if (idnames) {
        if (!fast) {
            let jishiqi
            let longth = 0
            if (path >= 0) {
                jishiqi = setInterval(function () {
                    if (longth < Math.abs(path)) {
                        longth += 0.5;
                        idnames.style.transform += `translateY(0.5px)`
                    } else {
                        clearInterval(jishiqi)
                    }
                }, time / 2);
            } else {
                jishiqi = setInterval(function () {
                    if (longth < Math.abs(path)) {
                        longth += 0.5;
                        idnames.style.transform += `translateY(-0.5px)`
                    } else {
                        clearInterval(jishiqi)
                    }
                }, time / 2);
            }
            return true

        } else {
            idnames.style.transform += `translateY(${path}px)`
            return true
        }
    } else {
        checkid(idname)
        return false
    }
}

/**
 * 将指定id元素旋转(注：此函数与moveX或者moveY一起使用会影响移动方向)
 * @param {any} idname - 指定元素的id
 * @param {any} path - 旋转的角度，默认为0。正为顺时针，负为逆时针。
 * @param {number} time - 每旋转1deg所需的单位。1单位约为4毫秒。默认为10单位。传入0时将恢复默认值。
 * @param {boolean} fast - 是否立即旋转。默认为false。
 */
function rotateCW(idname = "", angle = 0, time = 10, fast = false) {
    if (time <= 0) {
        time = Math.abs(time)
        if (time == 0) {
            time = 10
        }
    }
    const idnames = document.getElementById(`${idname}`)
    if (idnames) {

        if (!fast) {
            let jishiqi = null
            let longth = 0
            if (angle >= 0) {
                jishiqi = setInterval(function () {
                    if (longth < Math.abs(angle)) {
                        longth += 0.5;
                        idnames.style.transform += `rotate(0.5deg)`
                    } else {
                        clearInterval(jishiqi)
                    }
                }, time / 2);
            } else {
                jishiqi = setInterval(function () {
                    if (longth < Math.abs(angle)) {
                        longth += 0.5;
                        idnames.style.transform += `rotate(-0.5deg)`
                    } else {
                        clearInterval(jishiqi)
                    }
                }, time / 2);
            }

            return true

        } else {
            idnames.style.transform += `rotate(${angle}deg)`
            return true
        }
    } else {
        checkid(idname)
        return false
    }

}

/**
 *      使用例子
        async function run() {
            console.time('runTime:');
            console.log('1');
            await sleep(2000);
            console.log('2');
            await sleep(1000);
            console.log('3');
            console.timeEnd('runTime:');
        }

        run();
        console.log('a');
 * @param {any} time
 */
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

/**
 * 将指定id元素每隔一段时间向X方向移动
 * @param {any} idname - 指定元素的id
 * @param {any} path - 移动的距离，默认为0。正为右移，负为左移。
 * @param {number} time - 每移动1px所需的单位。1单位约为4毫秒。默认为10单位。传入0时将恢复默认值。
 * @param {number} everytime - 间隔时间。默认为2000毫秒。
 * @param {boolean} fast - 是否立即移动。默认为false。
 */
function moveXEvery(idname = "", path = 0, time = 10, everytime = 2000, fast = false) {
    (async function () {
        while (moveX(idname, path, time, fast)) {
            await sleep(everytime + (path * time))
        }
    })()
}

/**
 * 将指定id元素每隔一段时间向Y方向移动
 * @param {any} idname - 指定元素的id
 * @param {any} path - 移动的距离，默认为0。正为右移，负为左移。
 * @param {number} time - 每移动1px所需的单位。1单位约为4毫秒。默认为10单位。传入0时将恢复默认值。
 * @param {number} everytime - 间隔时间。默认为2000毫秒。
 * @param {boolean} fast - 是否立即移动。默认为false。
 */
function moveYEvery(idname = "", path = 0, time = 10, everytime = 2000, fast = false) {
    (async function () {
        while (moveY(idname, path, time, fast)) {
            await sleep(everytime + (path * time))
        }
    })()
}

/**
 * 将指定id元素每隔一段时间旋转(注：此函数与moveX或者moveY一起使用会影响移动方向)
 * @param {any} idname - 指定元素的id
 * @param {any} path - 旋转的角度，默认为0。正为顺时针，负为逆时针。
 * @param {number} time - 每旋转1deg所需的单位。1单位约为4毫秒。默认为10单位。传入0时将恢复默认值。
 * @param {number} everytime - 间隔时间。默认为2000毫秒。
 * @param {boolean} fast - 是否立即移动。默认为false。
 */
function rotateCWEvery(idname = "", angle = 0, time = 10, everytime = 2000, fast = false) {
    (async function () {
        while (rotateCW(idname, angle, time, fast)) {
            await sleep(everytime + (angle * time))
        }
    })()
}

/**
 *   使所有元素在悬停时显示元素的原始 HTML 代码,使用DOM2事件，使用时需定义两个全局变量：letname1和letname2
 *   返回数字。如果成功增加则返回1，如果成功删除则返回0。
 *   请注意不要连续使用添加函数。
 *   此函数不影响其他事件。
     使用案例：
     let letname1,letname2
     showTagCode()
     showTagCode(false)
 * @param {boolean} boolean - 布尔值，如果为true则运行添加动作，如果为false则删除动作，默认为true
 * @returns {number} - 返回数字。如果成功增加则返回1，如果成功删除则返回0
 */
function showTagCodeByAdd(boolean = true) {
    const elements = document.body.getElementsByTagName("*"); // 获取页面内所有元素
    if (boolean) {
        // 添加事件监听器
        letname1 = function () {
            this.title = this.outerHTML;
        };
        letname2 = function () {
            this.title = "";
        };

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            element.addEventListener("mouseover", letname1);
            element.addEventListener("mouseout", letname2);
        }
        return 1
    } else {
        // 删除事件监听器

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            element.removeEventListener("mouseover", letname1);
            element.removeEventListener("mouseout", letname2);
        }
        return 0
    }
}

/**
 *   使所有元素在悬停时显示元素的原始 HTML 代码，使用DOM0事件
 *   返回数字。如果成功增加则返回1，如果成功删除则返回0。
 *   连续使用添加函数无影响，但会覆盖之前定义的mouseover和mouseout事件
     使用案例：
     showTagCode()
     showTagCode(false)
 * @param {boolean} boolean - 布尔值，如果为true则运行添加动作，如果为false则删除动作，默认为true
 * @returns {number} - 返回数字。如果成功增加则返回1，如果成功删除则返回0
 */
function showTagCodeByOn(boolean = true) {
    const elements = document.body.getElementsByTagName("*"); // 获取页面内所有元素
    if (boolean) {
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            element.onmouseover = function () {
                this.title = this.outerHTML;
            };
            element.onmouseout = function () {
                this.title = "";
            };
        }
        return 1
    } else {
        // 删除事件监听器

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            element.onmouseover = null
            element.onmouseout = null
        }
        return 0
    }
}

/**
 * 检测内容是否为一定位数的从0-9的数字。存在返回ture，不存在返回false。
 * @param {any} idname - 指定的id名。默认为空
 * @param {any} minnumb - 最小位数，默认为0
 * @param {any} maxnumb - 最大位数，默认为6
 * @returns {boolean} 
 */
function numbcheck(str = "", minnumb = 0, maxnumb = 6) {
    const rule = new RegExp(`^[a-zA-Z0-9_]{${minnumb},${maxnumb}}$`)
    prints(rule)
    if (rule.test(str)) {
        return true
    } else {
        return false
    }
}

/**
 * 检测内容是否为一定位数的符合[a-zA-Z0-9_]规则的内容。存在返回ture，不存在返回false。
 * @param {any} idname - 指定的id名。默认为空
 * @param {any} minnumb - 最小位数，默认为0
 * @param {any} maxnumb - 最大位数，默认为6
 * @returns {boolean}
 */
function alpcheck(str = "", minnumb = 0, maxnumb = 6) {
    const rule = new RegExp(`^[a-zA-Z0-9_]{${minnumb},${maxnumb}}$`)
    prints(rule)
    if (rule.test(str)) {
        return true
    } else {
        return false
    }
}

/**
 * 返回一个或多个数组或数字的最大值，请注意并不会检测数组里的变量是否符合规则。
 * @param {...any} arr 一个或多个数组，如果数组里有字符串将会使其变为空字符。
 */
function arrMax(...arr) {
    let allarr = []
    for (let i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i]) || typeof (arr[i]) == "number") {
            if (typeof (arr[i]) == "number") {
                allarr.push(arr[i])
            } else {
                arr[i] = clearCharInStr(arr[i].join(" "), 1).split(" ")
                allarr.push(...arr[i])
            }
        } else {
            console.log(`${arr[i]}不是一个数组或者数字。`)
        }
    }
    return Math.max(...allarr)
}

/**
 * 返回一个或多个数组或数字的最小值，请注意并不会检测数组里的变量是否符合规则。
 * @param {...any} arr 一个或多个数组，如果数组里有字符串将会使其变为空字符。
 */
function arrMin(...arr) {
    let allarr = []
    for (let i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i]) || typeof (arr[i]) == "number") {
            if (typeof (arr[i]) == "number") {
                allarr.push(arr[i])
            } else {
                arr[i] = clearCharInStr(arr[i].join(" "), 1).split(" ")
                allarr.push(...arr[i])
            }
        } else {
            console.log(`${arr[i]}不是一个数组或者数字。`)
        }
    }
    return Math.min(...allarr)
}

/**
 * 返回该名字的元素数量
 * @param {any} name 必填项，所要查的id/class/tag
 * @param {any} way 0：根据class/1：根据id/2：根据tag。默认为0
 * @returns 返回-1或者数量
 */
function getDomNumb(name = "", way = 0) {
    if (name == "") {
        console.log("未输入名字");
        return -1;
    } else {
        name = name.trim();
        switch (way) {
            case 0:
                return document.querySelectorAll(`.${name}`).length;

            case 1:
                return document.querySelectorAll(`#${name}`).length;
            case 2:
                return document.querySelectorAll(`${name}`).length;
            default:
                return -1;

        }
    }
}

/**
 * 将string形式的二维数组转化为二维数组。
 * @param {any} strings 默认为"[[]]"
 */
function stringToArr(strings = "[[]]") {
    if (strings.startsWith("[[") && strings.endsWith("]]")) {
        strings = strings.substring(2);
        strings = strings.substring(0, strings.length - 2);
    }
    let arr = strings.split("], [");

    let arr1 = [];
    for (let i = 0; i < arr.length; i++) {

        arr1.push(arr[i].split(","));
    }
    let arr3 = arr1.join(",");
    arr3 = arr3.replace(/\"/g, "");
    let arr4 = arr3.split(",");

    const result = [];
    for (let i = 0; i < arr4.length; i += 4) {
        result.push(arr4.slice(i, i + 4));
    }
    return result;

}
/**
 * 去除字符串前后指定字符串
 * @param {any} str 字符串
 * @param {any} charToRemove 字符
 * @returns 
 */
function trimChars(str, charToRemove) {
    // 使用字符串的 split 和 join 方法来去除开头和结尾的指定字符  
    // 先去除开头的字符  
    while (str.startsWith(charToRemove)) {
        str = str.substring(1);
    }
    // 再去除结尾的字符  
    while (str.endsWith(charToRemove)) {
        str = str.substring(0, str.length - 1);
    }
    return str;
}

/**
 * hsv转为rgb
 * @param {any} h
 * @param {any} s
 * @param {any} v
 * @returns
 */
function hsvToRgb(h, s, v) {
    // 确保h在0到1之间  
    let hue = h / 360;
    // 确保s和v在0到1之间  
    let saturation = s / 100;
    let value = v / 100;

    let C = value * saturation; // 色度  
    let X = C * (1 - Math.abs((hue % 2) - 1));
    let m = value - C;

    let rgb = [];

    if (hue < 1 / 6) {
        rgb = [C + m, X + m, m];
    } else if (hue < 1 / 2) {
        rgb = [X + m, C + m, m];
    } else if (hue < 2 / 3) {
        rgb = [m, C + m, X + m];
    } else if (hue < 5 / 6) {
        rgb = [m, X + m, C + m];
    } else {
        rgb = [X + m, m, C + m];
    }

    // 将值从0-1范围转换到0-255范围  
    for (let i = 0; i < 3; i++) {
        rgb[i] = Math.round(rgb[i] * 255);
    }

    return rgb;
}


/**
 * 寻找颜色的相差最明显的颜色
 * @param {any} r 红色
 * @param {any} g 绿色
 * @param {any} b 蓝色
 * @returns 返回数组
 */
function FindColorByRGB([r, g, b]) {
    // 这里只计算色相  
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max / 255.0;
    let d = max - min;
    s = max == 0 ? 0 : d / max;

    if (max == min) {
        h = 0; // achromatic  
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h = (h + 0.5) % 1; // 将h值增加0.5（即180度），然后取模1  
    h *= 360; // 转换回0-360度  
    return hsvToRgb(h, s * 100, v * 100);
}

/**
 * 检查二维数组是否包含某个一维数组，并返回其下标
 * @param {any} twoDArray
 * @param {any} oneDArray
 * @returns
 */
function findArrayIndex(twoDArray, oneDArray) {
    // 遍历二维数组中的每一个子数组  
    for (let i = 0; i < twoDArray.length; i++) {
        // 检查当前子数组是否与给定的一维数组相等  
        if (arraysEqual(twoDArray[i], oneDArray)) {
            return i; // 如果找到相等的数组，返回其下标  
        }

    }
    return -1; // 如果没有找到相等的数组，返回-1表示未找到  
}

/**
 * 检查二维数组是否包含某个一维数组(除最后一维数组一位)，并返回其下标
 * @param {any} twoDArray
 * @param {any} oneDArray
 * @returns
 */
function findArrayIndexCutLast(twoDArray, oneDArray) {
    // 遍历二维数组中的每一个子数组  
    for (let i = 0; i < twoDArray.length; i++) {
        // 检查当前子数组是否与给定的一维数组相等  
        if (arraysEqualCutLast(twoDArray[i], oneDArray)) {
            return i; // 如果找到相等的数组，返回其下标  
        }
    }
    return -1; // 如果没有找到相等的数组，返回-1表示未找到  
}

/**
 * 检查两个数组是否相等  
 * @param {any} arr1
 * @param {any} arr2
 * @returns
 */
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}


/**
 * 检查两个数组除了最后一位是否相等  
 * @param {any} arr1
 * @param {any} arr2
 * @returns
 */
function arraysEqualCutLast(arr1, arr2) {
    for (let i = 0; i < arr1.length - 1; i++) {
        if (arr1[i] != arr2[i]) return false;
    }
    return true;
}

/**
 * 给指定classname的所有元素添加点击动作——点击切换某个classname是否存在于该元素classlist中，存在则删除，不存在则添加。
 * @param {any} _className 指定的元素
 * @param {any} _exchangeClassName 检查的classname
 */
function exchangeClassNameExist(_className = "", _exchangeClassName = "") {
    let element = document.getElementsByClassName(_className);
    for (let i = 0; i < element.length; i++) {
        //这里用onclick是为了防止重复添加
        element.onclick = function () {
            if (element[i].classList.contains(_exchangeClassName)) {
                element.classList.remove(_exchangeClassName);
            } else {
                element.classList.add(_exchangeClassName);
            }
        }
    }
}

/**
 * 显示/隐藏所有子目录
 * @param {any} _firstName -首次点击的目录的ID类名
 * @param {boolean} _setDisplay - true为显示，false为隐藏
 */
function ReturnAllChild(_firstName, _setDisplay) {
    if (!_firstName || getDomNumb(_firstName) <= 1) {
        return;
    }
    
    let currentchilds = document.getElementsByClassName(_firstName);
    for (let i = 1; i < currentchilds.length; i++) {
        if (currentchilds[i].style.display == "none" && _setDisplay) {
            currentchilds[i].style.display = "block";
        } else if (currentchilds[i].style.display == "block" && !_setDisplay) {
            currentchilds[i].style.display = "none";
        }

        // 只有当子目录有子目录时才递归
        let childClass = currentchilds[i].classList[2];
        if (childClass && childClass !== "select" && getDomNumb(childClass) > 1) {
            ReturnAllChild(childClass, _setDisplay);
        }
    }
}