!function(root, factory) {
    "function" == typeof define && define.amd ? define([ "require", "exports", "ometa-core", "lodash" ], factory) : "object" == typeof exports ? factory(require, exports, require("ometa-js").core) : factory(function(moduleName) {
        return root[moduleName];
    }, root, root.OMeta);
}(this, function(require, exports, OMeta) {
    var _ = require("lodash"), AbstractSQLValidator = OMeta._extend({
        Query: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._apply("SelectQuery");
        },
        SelectQuery: function() {
            var $elf = this, _fromIdx = this.input.idx, from, groupBy, limit, offset, orderBy, query, queryPart, select, where;
            this._form(function() {
                this._applyWithArgs("exactly", "SelectQuery");
                query = [ "SelectQuery" ];
                this._many1(function() {
                    queryPart = this._or(function() {
                        this._pred(null == select);
                        return select = this._apply("Select");
                    }, function() {
                        return from = this._apply("Table");
                    }, function() {
                        return this._apply("Join");
                    }, function() {
                        this._pred(null == where);
                        return where = this._apply("Where");
                    }, function() {
                        this._pred(null == groupBy);
                        return groupBy = this._apply("GroupBy");
                    }, function() {
                        this._pred(null == orderBy);
                        return orderBy = this._apply("OrderBy");
                    }, function() {
                        this._pred(null == limit);
                        return limit = this._apply("Limit");
                    }, function() {
                        this._pred(null == offset);
                        return offset = this._apply("Offset");
                    });
                    return query = query.concat(queryPart);
                });
                this._pred(null != select);
                return this._pred(null != from);
            });
            return query;
        },
        DeleteQuery: function() {
            var $elf = this, _fromIdx = this.input.idx, query, queryPart, table, where;
            this._form(function() {
                this._applyWithArgs("exactly", "DeleteQuery");
                query = [ "DeleteQuery" ];
                this._many(function() {
                    queryPart = this._or(function() {
                        return table = this._apply("Table");
                    }, function() {
                        this._pred(null == where);
                        return where = this._apply("Where");
                    });
                    return query = query.concat(queryPart);
                });
                return this._pred(null != table);
            });
            return query;
        },
        UpsertQuery: function() {
            var $elf = this, _fromIdx = this.input.idx, body;
            this._form(function() {
                this._applyWithArgs("exactly", "UpsertQuery");
                return body = this._apply("UpdateBody");
            });
            return [ "UpsertQuery" ].concat(body);
        },
        InsertQuery: function() {
            var $elf = this, _fromIdx = this.input.idx, body;
            this._form(function() {
                this._applyWithArgs("exactly", "InsertQuery");
                return body = this._apply("InsertBody");
            });
            return [ "InsertQuery" ].concat(body);
        },
        UpdateQuery: function() {
            var $elf = this, _fromIdx = this.input.idx, body;
            this._form(function() {
                this._applyWithArgs("exactly", "UpdateQuery");
                return body = this._apply("UpdateBody");
            });
            return [ "UpdateQuery" ].concat(body);
        },
        InsertBody: function() {
            var $elf = this, _fromIdx = this.input.idx, body, bodyPart, fieldValues, table;
            body = [];
            this._many1(function() {
                bodyPart = this._or(function() {
                    return fieldValues = this._apply("Fields");
                }, function() {
                    return table = this._apply("Table");
                });
                return body = body.concat(bodyPart);
            });
            this._pred(null != fieldValues);
            this._pred(null != table);
            return body;
        },
        UpdateBody: function() {
            var $elf = this, _fromIdx = this.input.idx, body, bodyPart, fieldValues, table, where;
            body = [];
            this._many1(function() {
                bodyPart = this._or(function() {
                    return fieldValues = this._apply("Fields");
                }, function() {
                    return table = this._apply("Table");
                }, function() {
                    this._pred(null == where);
                    return where = this._apply("Where");
                });
                return body = body.concat(bodyPart);
            });
            this._pred(null != fieldValues && fieldValues[0][1].length > 0);
            this._pred(null != table);
            return body;
        },
        Fields: function() {
            var $elf = this, _fromIdx = this.input.idx, field, fields, value;
            this._form(function() {
                this._applyWithArgs("exactly", "Fields");
                return this._form(function() {
                    return fields = this._many(function() {
                        this._form(function() {
                            field = this.anything();
                            return value = this._or(function() {
                                switch (this.anything()) {
                                  case "?":
                                    return "?";

                                  default:
                                    throw this._fail();
                                }
                            }, function() {
                                return this._apply("true");
                            }, function() {
                                return this._apply("false");
                            }, function() {
                                return this._apply("Null");
                            }, function() {
                                return this._apply("Bind");
                            }, function() {
                                return this.anything();
                            });
                        });
                        return [ field, value ];
                    });
                });
            });
            return [ [ "Fields", fields ] ];
        },
        Select: function() {
            var $elf = this, _fromIdx = this.input.idx, as, fields, table, value;
            this._form(function() {
                this._applyWithArgs("exactly", "Select");
                return this._form(function() {
                    return fields = this._many(function() {
                        return this._or(function() {
                            return this._apply("Count");
                        }, function() {
                            return this._form(function() {
                                table = this.anything();
                                return this._applyWithArgs("exactly", "*");
                            });
                        }, function() {
                            this._form(function() {
                                value = this._apply("AnyValue");
                                return as = this.anything();
                            });
                            return [ value, as ];
                        }, function() {
                            return this._apply("AnyValue");
                        }, function() {
                            switch (this.anything()) {
                              case "*":
                                return "*";

                              default:
                                throw this._fail();
                            }
                        }, function() {
                            return this._apply("Null");
                        });
                    });
                });
            });
            return [ [ "Select", fields ] ];
        },
        Count: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._form(function() {
                this._applyWithArgs("exactly", "Count");
                return this._applyWithArgs("exactly", "*");
            });
        },
        Table: function() {
            var $elf = this, _fromIdx = this.input.idx, as, from, table;
            this._form(function() {
                this._applyWithArgs("exactly", "From");
                return from = this._or(function() {
                    this._not(function() {
                        return this._apply("string");
                    });
                    this._form(function() {
                        table = this._or(function() {
                            return this._apply("SelectQuery");
                        }, function() {
                            return this.anything();
                        });
                        return as = this.anything();
                    });
                    return [ table, as ];
                }, function() {
                    return this._apply("SelectQuery");
                }, function() {
                    return this.anything();
                });
            });
            return [ [ "From", from ] ];
        },
        Join: function() {
            var $elf = this, _fromIdx = this.input.idx, boolStatement, table;
            this._form(function() {
                this._applyWithArgs("exactly", "Join");
                this._form(function() {
                    this._applyWithArgs("exactly", "With");
                    return table = this.anything();
                });
                return this._form(function() {
                    this._applyWithArgs("exactly", "On");
                    return boolStatement = this._apply("BooleanValue");
                });
            });
            return [ [ "Join", [ "With", table ], [ "On", boolStatement ] ] ];
        },
        Where: function() {
            var $elf = this, _fromIdx = this.input.idx, boolStatement;
            this._form(function() {
                this._applyWithArgs("exactly", "Where");
                return boolStatement = this._apply("BooleanValue");
            });
            return [ [ "Where", boolStatement ] ];
        },
        GroupBy: function() {
            var $elf = this, _fromIdx = this.input.idx, values;
            this._form(function() {
                this._applyWithArgs("exactly", "GroupBy");
                return this._form(function() {
                    return values = this._many1(function() {
                        return this._apply("AnyValue");
                    });
                });
            });
            return [ [ "GroupBy", values ] ];
        },
        OrderBy: function() {
            var $elf = this, _fromIdx = this.input.idx, field, order, orders;
            this._form(function() {
                this._applyWithArgs("exactly", "OrderBy");
                return orders = this._many1(function() {
                    this._form(function() {
                        order = function() {
                            switch (this.anything()) {
                              case "ASC":
                                return "ASC";

                              case "DESC":
                                return "DESC";

                              default:
                                throw this._fail();
                            }
                        }.call(this);
                        return field = this._or(function() {
                            return this._apply("Field");
                        }, function() {
                            return this._apply("ReferencedField");
                        });
                    });
                    return [ order, field ];
                });
            });
            return [ [ "OrderBy" ].concat(orders) ];
        },
        Limit: function() {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._form(function() {
                this._applyWithArgs("exactly", "Limit");
                return num = this._apply("NumericValue");
            });
            return [ [ "Limit", num ] ];
        },
        Offset: function() {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._form(function() {
                this._applyWithArgs("exactly", "Offset");
                return num = this._apply("NumericValue");
            });
            return [ [ "Offset", num ] ];
        },
        AnyValue: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("UnknownValue");
            }, function() {
                return this._apply("TextValue");
            }, function() {
                return this._apply("NumericValue");
            }, function() {
                return this._apply("BooleanValue");
            }, function() {
                return this._apply("DateValue");
            }, function() {
                return this._apply("JSONValue");
            });
        },
        UnknownValue: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("ReferencedField");
            }, function() {
                return this._apply("Field");
            }, function() {
                return this._apply("Bind");
            }, function() {
                return this._apply("Null");
            }, function() {
                return this._apply("SelectQuery");
            });
        },
        Field: function() {
            var $elf = this, _fromIdx = this.input.idx, field;
            return this._form(function() {
                this._applyWithArgs("exactly", "Field");
                return field = this.anything();
            });
        },
        ReferencedField: function() {
            var $elf = this, _fromIdx = this.input.idx, field, table;
            return this._form(function() {
                this._applyWithArgs("exactly", "ReferencedField");
                table = this.anything();
                return field = this.anything();
            });
        },
        Bind: function() {
            var $elf = this, _fromIdx = this.input.idx, field, tableName;
            return this._form(function() {
                this._applyWithArgs("exactly", "Bind");
                tableName = this.anything();
                return field = this.anything();
            });
        },
        Null: function() {
            var $elf = this, _fromIdx = this.input.idx, next;
            next = this.anything();
            this._pred(null === next);
            return null;
        },
        TextValue: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("UnknownValue");
            }, function() {
                return this._apply("Text");
            }, function() {
                return this._apply("Concat");
            }, function() {
                return this._apply("Lower");
            }, function() {
                return this._apply("Upper");
            }, function() {
                return this._apply("Trim");
            }, function() {
                return this._apply("Replace");
            }, function() {
                return this._apply("Substring");
            });
        },
        Text: function() {
            var $elf = this, _fromIdx = this.input.idx, text;
            return this._form(function() {
                (function() {
                    switch (this.anything()) {
                      case "Text":
                        return "Text";

                      case "Value":
                        return "Value";

                      default:
                        throw this._fail();
                    }
                }).call(this);
                return text = this.anything();
            });
        },
        Concat: function() {
            var $elf = this, _fromIdx = this.input.idx, firstString, otherStrings;
            this._form(function() {
                (function() {
                    switch (this.anything()) {
                      case "Concat":
                        return "Concat";

                      case "Concatenate":
                        return "Concatenate";

                      default:
                        throw this._fail();
                    }
                }).call(this);
                firstString = this._apply("TextValue");
                return otherStrings = this._many1(function() {
                    return this._apply("TextValue");
                });
            });
            return [ "Concatenate", firstString ].concat(otherStrings);
        },
        Lower: function() {
            var $elf = this, _fromIdx = this.input.idx, string;
            this._form(function() {
                (function() {
                    switch (this.anything()) {
                      case "Lower":
                        return "Lower";

                      case "ToLower":
                        return "ToLower";

                      case "Tolower":
                        return "Tolower";

                      default:
                        throw this._fail();
                    }
                }).call(this);
                return string = this._apply("TextValue");
            });
            return [ "Lower", string ];
        },
        Upper: function() {
            var $elf = this, _fromIdx = this.input.idx, string;
            this._form(function() {
                (function() {
                    switch (this.anything()) {
                      case "ToUpper":
                        return "ToUpper";

                      case "Toupper":
                        return "Toupper";

                      case "Upper":
                        return "Upper";

                      default:
                        throw this._fail();
                    }
                }).call(this);
                return string = this._apply("TextValue");
            });
            return [ "Upper", string ];
        },
        Trim: function() {
            var $elf = this, _fromIdx = this.input.idx, str;
            this._form(function() {
                this._applyWithArgs("exactly", "Trim");
                return str = this._apply("TextValue");
            });
            return [ "Trim", str ];
        },
        Replace: function() {
            var $elf = this, _fromIdx = this.input.idx, find, replacement, string;
            this._form(function() {
                this._applyWithArgs("exactly", "Replace");
                string = this._apply("TextValue");
                find = this._apply("TextValue");
                return replacement = this._apply("TextValue");
            });
            return [ "Replace", string, find, replacement ];
        },
        Substring: function() {
            var $elf = this, _fromIdx = this.input.idx, args, string;
            this._form(function() {
                this._applyWithArgs("exactly", "Substring");
                string = this._apply("TextValue");
                return args = this._many1(function() {
                    return this._apply("NumericValue");
                });
            });
            return [ "Substring", string ].concat(args);
        },
        NumericValue: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("UnknownValue");
            }, function() {
                return this._apply("Number");
            }, function() {
                return this._apply("MathOp");
            }, function() {
                return this._apply("BitwiseAnd");
            }, function() {
                return this._apply("BitwiseShiftRight");
            }, function() {
                return this._apply("CharacterLength");
            }, function() {
                return this._apply("InStr");
            }, function() {
                return this._apply("IndexOf");
            }, function() {
                return this._apply("StrPos");
            }, function() {
                return this._apply("Round");
            }, function() {
                return this._apply("Floor");
            }, function() {
                return this._apply("Ceiling");
            });
        },
        Number: function() {
            var $elf = this, _fromIdx = this.input.idx, number;
            return this._form(function() {
                (function() {
                    switch (this.anything()) {
                      case "Integer":
                        return "Integer";

                      case "Number":
                        return "Number";

                      case "Real":
                        return "Real";

                      default:
                        throw this._fail();
                    }
                }).call(this);
                return number = this.anything();
            });
        },
        MathOp: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("Add");
            }, function() {
                return this._apply("Subtract");
            }, function() {
                return this._apply("Multiply");
            }, function() {
                return this._apply("Divide");
            });
        },
        Add: function() {
            var $elf = this, _fromIdx = this.input.idx, lhs, rhs;
            this._form(function() {
                this._applyWithArgs("exactly", "Add");
                lhs = this._apply("NumericValue");
                return rhs = this._apply("NumericValue");
            });
            return [ "Add", lhs, rhs ];
        },
        Subtract: function() {
            var $elf = this, _fromIdx = this.input.idx, lhs, rhs;
            this._form(function() {
                this._applyWithArgs("exactly", "Subtract");
                lhs = this._apply("NumericValue");
                return rhs = this._apply("NumericValue");
            });
            return [ "Subtract", lhs, rhs ];
        },
        Multiply: function() {
            var $elf = this, _fromIdx = this.input.idx, lhs, rhs;
            this._form(function() {
                this._applyWithArgs("exactly", "Multiply");
                lhs = this._apply("NumericValue");
                return rhs = this._apply("NumericValue");
            });
            return [ "Multiply", lhs, rhs ];
        },
        Divide: function() {
            var $elf = this, _fromIdx = this.input.idx, lhs, rhs;
            this._form(function() {
                this._applyWithArgs("exactly", "Divide");
                lhs = this._apply("NumericValue");
                return rhs = this._apply("NumericValue");
            });
            return [ "Divide", lhs, rhs ];
        },
        BitwiseAnd: function() {
            var $elf = this, _fromIdx = this.input.idx, mask, operand;
            this._form(function() {
                this._applyWithArgs("exactly", "BitwiseAnd");
                operand = this._apply("NumericValue");
                return mask = this._apply("NumericValue");
            });
            return [ "BitwiseAnd", operand, mask ];
        },
        BitwiseShiftRight: function() {
            var $elf = this, _fromIdx = this.input.idx, operand, shift;
            this._form(function() {
                this._applyWithArgs("exactly", "BitwiseShiftRight");
                operand = this._apply("NumericValue");
                return shift = this._apply("NumericValue");
            });
            return [ "BitwiseShiftRight", operand, shift ];
        },
        CharacterLength: function() {
            var $elf = this, _fromIdx = this.input.idx, text;
            this._form(function() {
                this._applyWithArgs("exactly", "CharacterLength");
                return text = this._apply("TextValue");
            });
            return [ "CharacterLength", text ];
        },
        InStr: function() {
            var $elf = this, _fromIdx = this.input.idx, haystack, needle;
            this._form(function() {
                this._applyWithArgs("exactly", "InStr");
                haystack = this._apply("TextValue");
                return needle = this._apply("TextValue");
            });
            return [ "InStr", haystack, needle ];
        },
        IndexOf: function() {
            var $elf = this, _fromIdx = this.input.idx, haystack, needle;
            this._form(function() {
                (function() {
                    switch (this.anything()) {
                      case "IndexOf":
                        return "IndexOf";

                      case "Indexof":
                        return "Indexof";

                      default:
                        throw this._fail();
                    }
                }).call(this);
                haystack = this._apply("TextValue");
                return needle = this._apply("TextValue");
            });
            this._apply("SetHelped");
            return [ "InStr", haystack, needle ];
        },
        StrPos: function() {
            var $elf = this, _fromIdx = this.input.idx, haystack, needle;
            this._form(function() {
                this._applyWithArgs("exactly", "StrPos");
                haystack = this._apply("TextValue");
                return needle = this._apply("TextValue");
            });
            return [ "StrPos", haystack, needle ];
        },
        Round: function() {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._form(function() {
                this._applyWithArgs("exactly", "Round");
                return num = this._apply("NumericValue");
            });
            return [ "Round", num ];
        },
        Floor: function() {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._form(function() {
                this._applyWithArgs("exactly", "Floor");
                return num = this._apply("NumericValue");
            });
            return [ "Floor", num ];
        },
        Ceiling: function() {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._form(function() {
                this._applyWithArgs("exactly", "Ceiling");
                return num = this._apply("NumericValue");
            });
            return [ "Ceiling", num ];
        },
        BooleanValue: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("UnknownValue");
            }, function() {
                return this._apply("Boolean");
            }, function() {
                return this._apply("And");
            }, function() {
                return this._apply("Not");
            }, function() {
                return this._apply("Or");
            }, function() {
                return this._apply("Exists");
            }, function() {
                return this._apply("Comparison");
            }, function() {
                return this._apply("Between");
            });
        },
        Boolean: function() {
            var $elf = this, _fromIdx = this.input.idx, bool;
            this._form(function() {
                this._applyWithArgs("exactly", "Boolean");
                return bool = this._or(function() {
                    return this._apply("true");
                }, function() {
                    return this._apply("false");
                });
            });
            return [ "Boolean", bool ];
        },
        Not: function() {
            var $elf = this, _fromIdx = this.input.idx, bool;
            this._form(function() {
                this._applyWithArgs("exactly", "Not");
                return bool = this._apply("BooleanValue");
            });
            return [ "Not", bool ];
        },
        And: function() {
            var $elf = this, _fromIdx = this.input.idx, firstBool, otherBools;
            this._form(function() {
                this._applyWithArgs("exactly", "And");
                firstBool = this._apply("BooleanValue");
                return otherBools = this._many1(function() {
                    return this._apply("BooleanValue");
                });
            });
            return [ "And", firstBool ].concat(otherBools);
        },
        Or: function() {
            var $elf = this, _fromIdx = this.input.idx, firstBool, otherBools;
            this._form(function() {
                this._applyWithArgs("exactly", "Or");
                firstBool = this._apply("BooleanValue");
                return otherBools = this._many1(function() {
                    return this._apply("BooleanValue");
                });
            });
            return [ "Or", firstBool ].concat(otherBools);
        },
        Exists: function() {
            var $elf = this, _fromIdx = this.input.idx, exists;
            this._form(function() {
                this._applyWithArgs("exactly", "Exists");
                return exists = this._apply("AnyValue");
            });
            return [ "Exists", exists ];
        },
        Comparison: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("Equals");
            }, function() {
                return this._apply("GreaterThan");
            }, function() {
                return this._apply("GreaterThanOrEqual");
            }, function() {
                return this._apply("LessThan");
            }, function() {
                return this._apply("LessThanOrEqual");
            }, function() {
                return this._apply("NotEquals");
            }, function() {
                return this._apply("Like");
            });
        },
        Equals: function() {
            var $elf = this, _fromIdx = this.input.idx, comp1, comp2;
            this._form(function() {
                this._applyWithArgs("exactly", "Equals");
                comp1 = this._apply("AnyValue");
                return comp2 = this._apply("AnyValue");
            });
            return [ "Equals", comp1, comp2 ];
        },
        GreaterThan: function() {
            var $elf = this, _fromIdx = this.input.idx, comp1, comp2;
            this._form(function() {
                this._applyWithArgs("exactly", "GreaterThan");
                comp1 = this._apply("AnyValue");
                return comp2 = this._apply("AnyValue");
            });
            return [ "GreaterThan", comp1, comp2 ];
        },
        GreaterThanOrEqual: function() {
            var $elf = this, _fromIdx = this.input.idx, comp1, comp2;
            this._form(function() {
                this._applyWithArgs("exactly", "GreaterThanOrEqual");
                comp1 = this._apply("AnyValue");
                return comp2 = this._apply("AnyValue");
            });
            return [ "GreaterThanOrEqual", comp1, comp2 ];
        },
        LessThan: function() {
            var $elf = this, _fromIdx = this.input.idx, comp1, comp2;
            this._form(function() {
                this._applyWithArgs("exactly", "LessThan");
                comp1 = this._apply("AnyValue");
                return comp2 = this._apply("AnyValue");
            });
            return [ "LessThan", comp1, comp2 ];
        },
        LessThanOrEqual: function() {
            var $elf = this, _fromIdx = this.input.idx, comp1, comp2;
            this._form(function() {
                this._applyWithArgs("exactly", "LessThanOrEqual");
                comp1 = this._apply("AnyValue");
                return comp2 = this._apply("AnyValue");
            });
            return [ "LessThanOrEqual", comp1, comp2 ];
        },
        NotEquals: function() {
            var $elf = this, _fromIdx = this.input.idx, comp1, comp2;
            this._form(function() {
                this._applyWithArgs("exactly", "NotEquals");
                comp1 = this._apply("AnyValue");
                return comp2 = this._apply("AnyValue");
            });
            return [ "NotEquals", comp1, comp2 ];
        },
        Like: function() {
            var $elf = this, _fromIdx = this.input.idx, comp1, comp2;
            this._form(function() {
                this._applyWithArgs("exactly", "Like");
                comp1 = this._apply("AnyValue");
                return comp2 = this._apply("AnyValue");
            });
            return [ "Like", comp1, comp2 ];
        },
        Between: function() {
            var $elf = this, _fromIdx = this.input.idx, comp1, comp2, comp3;
            this._form(function() {
                this._applyWithArgs("exactly", "Between");
                comp1 = this._apply("AnyValue");
                comp2 = this._apply("AnyValue");
                return comp3 = this._apply("AnyValue");
            });
            return [ "Between", comp1, comp2, comp3 ];
        },
        DateValue: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("UnknownValue");
            }, function() {
                return this._apply("Date");
            });
        },
        Date: function() {
            var $elf = this, _fromIdx = this.input.idx, date;
            this._form(function() {
                this._applyWithArgs("exactly", "Date");
                return date = this.anything();
            });
            this._pred(_.isDate(date));
            return [ "Date", date ];
        },
        JSONValue: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("UnknownValue");
            }, function() {
                return this._apply("AggregateJSON");
            });
        },
        AggregateJSON: function() {
            var $elf = this, _fromIdx = this.input.idx, field;
            this._form(function() {
                this._applyWithArgs("exactly", "AggregateJSON");
                return field = this.anything();
            });
            return [ "AggregateJSON", field ];
        }
    }), AbstractSQLOptimiser = exports.AbstractSQLOptimiser = AbstractSQLValidator._extend({
        Not: function() {
            var $elf = this, _fromIdx = this.input.idx, boolStatement;
            return this._or(function() {
                this._form(function() {
                    this._applyWithArgs("exactly", "Not");
                    return this._or(function() {
                        return this._form(function() {
                            this._applyWithArgs("exactly", "Not");
                            return boolStatement = this._apply("BooleanValue");
                        });
                    }, function() {
                        boolStatement = this._apply("Equals");
                        return boolStatement[0] = "NotEquals";
                    });
                });
                this._apply("SetHelped");
                return boolStatement;
            }, function() {
                return AbstractSQLValidator._superApplyWithArgs(this, "Not");
            });
        },
        BooleanValue: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("Substringof");
            }, function() {
                return this._apply("StartsWith");
            }, function() {
                return this._apply("EndsWith");
            }, function() {
                return AbstractSQLValidator._superApplyWithArgs(this, "BooleanValue");
            });
        },
        Substringof: function() {
            var $elf = this, _fromIdx = this.input.idx, haystack, needle;
            this._form(function() {
                this._applyWithArgs("exactly", "Substringof");
                needle = this._apply("TextValue");
                return haystack = this._apply("TextValue");
            });
            this._apply("SetHelped");
            return [ "Like", haystack, [ "Concat", [ "Text", "%" ], needle, [ "Text", "%" ] ] ];
        },
        StartsWith: function() {
            var $elf = this, _fromIdx = this.input.idx, haystack, needle;
            this._form(function() {
                this._applyWithArgs("exactly", "Startswith");
                needle = this._apply("TextValue");
                return haystack = this._apply("TextValue");
            });
            this._apply("SetHelped");
            return [ "Like", haystack, [ "Concat", needle, [ "Text", "%" ] ] ];
        },
        EndsWith: function() {
            var $elf = this, _fromIdx = this.input.idx, haystack, needle;
            this._form(function() {
                this._applyWithArgs("exactly", "Endswith");
                needle = this._apply("TextValue");
                return haystack = this._apply("TextValue");
            });
            this._apply("SetHelped");
            return [ "Like", haystack, [ "Concat", [ "Text", "%" ], needle ] ];
        },
        Helped: function(disableMemoisationHack) {
            var $elf = this, _fromIdx = this.input.idx;
            this._pred(this.helped === !0);
            return this.helped = !1;
        },
        SetHelped: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this.helped = !0;
        },
        Process: function() {
            var $elf = this, _fromIdx = this.input.idx, query;
            query = this.anything();
            query = this._or(function() {
                return this._applyWithArgs("AnyValue", query);
            }, function() {
                return this._applyWithArgs("SelectQuery", query);
            }, function() {
                return this._applyWithArgs("InsertQuery", query);
            }, function() {
                return this._applyWithArgs("UpdateQuery", query);
            }, function() {
                return this._applyWithArgs("DeleteQuery", query);
            }, function() {
                return this._applyWithArgs("UpsertQuery", query);
            });
            this._many(function() {
                this._applyWithArgs("Helped", "disableMemoisation");
                return query = this._or(function() {
                    return this._applyWithArgs("AnyValue", query);
                }, function() {
                    return this._applyWithArgs("SelectQuery", query);
                }, function() {
                    return this._applyWithArgs("InsertQuery", query);
                }, function() {
                    return this._applyWithArgs("UpdateQuery", query);
                }, function() {
                    return this._applyWithArgs("DeleteQuery", query);
                }, function() {
                    return this._applyWithArgs("UpsertQuery", query);
                });
            });
            return query;
        }
    });
    AbstractSQLOptimiser.initialize = function() {
        this.helped = !1;
    };
});