// ============================================
// DOM 元素创建函数
// ============================================

/**
 * 创建一个div在指定的id里，成功返回新id名，失败返回false
 * @param {string} creatadds - 指定的id，新的div将创建在它之里，必填项
 * @param {string} idname - 给予新的div的id，默认为空
 * @param {string} classname - 给予新的div的类名，默认为空
 */
function creatDivById(creatadds = "", idname = "", classname = "") {
    let ids = document.getElementById(creatadds);
    if (ids) {
        let div = document.createElement("div");
        div.setAttribute("id", idname);
        div.setAttribute("class", classname);
        ids.appendChild(div);
        return idname;
    } else {
        return false;
    }
}

/**
 * 创建一个div在指定的id后，成功返回新id名，失败返回false
 * @param {string} creatadds - 指定的id，新的div将创建在它之后，必填项
 * @param {string} idname - 给予新的div的id，默认为空
 * @param {string} classname - 给予新的div的类名，默认为空
 */
function creatDivByIdBefore(creatadds = "", idname = "", classname = "") {
    let ids = document.getElementById(creatadds);
    if (ids) {
        let div = document.createElement("div");
        div.setAttribute("id", idname);
        div.setAttribute("class", classname);
        ids.after(div);
        return idname;
    } else {
        return false;
    }
}

/**
 * 创建一个div在指定的类名里，成功返回新id名，失败返回false
 * @param {string} creatadds - 指定的类名，新的div将创建在它之里，必填项
 * @param {string} idname - 给予新的div的id，默认为空
 * @param {string} classname - 给予新的div的类名，默认为空
 * @param {number} creataddsxiaobiao - 指定类名的下标，默认为0
 */
function creatDivByClass(creatadds = "", idname = "", classname = "", creataddsxiaobiao = 0) {
    let classnames = document.getElementsByClassName(creatadds)[creataddsxiaobiao];
    let classnameslenth = document.getElementsByClassName(creatadds).length;
    if (classnames) {
        let div = document.createElement("div");
        div.setAttribute("id", idname);
        div.setAttribute("class", classname);
        classnames.appendChild(div);
        return idname;
    } else {
        if (creataddsxiaobiao > classnameslenth - 1 && classnameslenth) {
            console.error(`找不到指定的下标：${creataddsxiaobiao}.最大下标为${classnameslenth - 1}`);
        } else {
            console.error(`找不到指定的类名：${creatadds}`);
        }
        return false;
    }
}

// ============================================
// ID 相关工具函数
// ============================================

/**
 * 返回页面内所有id，返回类型为数组 
 */
function allId() {
    let chucunid = [];
    let ids = document.getElementsByTagName("*");
    for (let i = 0, j = 0; i < ids.length; i++) {
        if (ids[i].id) {
            chucunid[j] = ids[i].id;
            j++;
        }
    }
    return chucunid;
}

/**
 * 检查是否存在此id，返回id下标或者布尔值
 * @param {string} idname - id名
 * @param {number} fanhui - 0为返回id下标，其他数字为返回true或false。默认为0
 * @param {number} findway - 寻找方式，默认为0
 */
function checkid(idname, fanhui = 0, findway = 0) {
    if (idname === null || idname === undefined) {
        return false;
    }
    
    let ids = allId();
    if (ids.indexOf(idname) >= 0) {
        console.log(`存在此id名："${idname}"`);
        if (fanhui === 0) {
            return ids.indexOf(idname);
        } else {
            return true;
        }
    } else {
        ids[ids.length] = idname;
        if (findway === 0) {
            ids = minToMaxStred(ids);
        } else {
            ids = minToMaxStr(ids);
        }
        if (ids.indexOf(idname) + 1 === ids.length) {
            console.log(`不存在此id名："${idname}"，最接近的id名有："${ids[ids.indexOf(idname) - 1]}"，"${ids[ids.indexOf(idname) - 2]}"`);
            if (fanhui === 0) {
                return [ids[ids.indexOf(idname) - 1], ids[ids.indexOf(idname) - 2]];
            } else {
                return false;
            }
        } else if (ids.indexOf(idname) === 0) {
            console.log(`不存在此id名："${idname}"，最接近的id名有："${ids[ids.indexOf(idname) + 1]}"，"${ids[ids.indexOf(idname) + 2]}"`);
            if (fanhui === 0) {
                return [ids[ids.indexOf(idname) + 1], ids[ids.indexOf(idname) + 2]];
            } else {
                return false;
            }
        } else {
            console.log(`不存在此id名："${idname}"，最接近的id名有："${ids[ids.indexOf(idname) - 1]}"，"${ids[ids.indexOf(idname) + 1]}"`);
            if (fanhui === 0) {
                return [ids[ids.indexOf(idname) - 1], ids[ids.indexOf(idname) + 1]];
            } else {
                return false;
            }
        }
    }
}

/**
 * 获取一定区间内的整数
 * @param {number} min - 最小值，默认为0
 * @param {number} max - 最大值，默认为10
 */
function getInt(min = 0, max = 10) {
    let mid;
    if (min > max) {
        mid = min;
        min = max;
        max = mid;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 得到一个不重复的id名
 * @param {number} idlength - id名的长度，默认为6
 * @param {number} isUpper - 是否全部大写/小写。0为随机大小写（首字母小写），1为全部大写，2为全部小写。默认为0
 */
function getOneId(idlength = 6, isUpper = 0) {
    if (isUpper >= 3) {
        isUpper = 2;
    }
    if (isUpper < 0) {
        isUpper = 0;
    }
    while (true) {
        let zumu = "abcdefghijklmnopqrstuvwxyz".split("");
        let allids = allId();
        let zumnu;
        let suijishu;
        let xiabiao = 0;
        let idname = [];
        for (let i = 0; i < idlength; i++) {
            xiabiao = getInt(0, zumu.length - 1);
            suijishu = getInt(1, 3);
            if (isUpper === 0) {
                if (i === 0) {
                    suijishu = 2;
                }
                if (suijishu === 1) {
                    zumnu = zumu[xiabiao].toUpperCase();
                    idname[i] = zumnu;
                } else {
                    zumnu = zumu[xiabiao];
                    idname[i] = zumnu;
                }
            } else if (isUpper === 1) {
                zumnu = zumu[xiabiao].toUpperCase();
                idname[i] = zumnu;
            } else if (isUpper === 2) {
                zumnu = zumu[xiabiao];
                idname[i] = zumnu;
            }
        }
        let idnames = idname.join("");
        if (allids.indexOf(idnames) === -1) {
            return idnames;
        }
    }
}

// ============================================
// 字符串排序函数（checkid 依赖）
// ============================================

/**
 * 对纯字符串数组按首字母和长度由小到大进行排序
 * @param {string[]} arr - 任意数组，默认为[""]
 */
function minToMaxStr(arr = [""]) {
    let team;
    for (let i = 0; i < arr.length; i++) {
        for (let y = i; y < arr.length; y++) {
            if (arr[y].slice(0, 1) < arr[i].slice(0, 1)) {
                team = arr[i];
                arr[i] = arr[y];
                arr[y] = team;
            }
        }
    }
    for (let i = 0; i < arr.length; i++) {
        for (let y = i; y < arr.length; y++) {
            if (arr[y].length < arr[i].length) {
                team = arr[i];
                arr[i] = arr[y];
                arr[y] = team;
            }
        }
    }
    return arr;
}

/**
 * 对纯字符串数组按字母由小到大进行排序
 * @param {string[]} arr - 任意数组，默认为[""]
 */
function minToMaxStred(arr = [""]) {
    arr = arr.filter(item => item !== null && item !== undefined && typeof item === 'string');
    
    arr.sort(function (a, b) {
        if (typeof a !== 'string') a = String(a || '');
        if (typeof b !== 'string') b = String(b || '');
        
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i].charCodeAt() !== b[i].charCodeAt()) {
                return a[i].charCodeAt() - b[i].charCodeAt();
            }
        }
        return a.length - b.length;
    });
    return arr;
}

// ============================================
// 数据转换函数
// ============================================

/**
 * 将string形式的二维数组转化为二维数组
 * @param {string} strings - 默认为"[[]]"
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
