!function(root, factory) {
    "function" == typeof define && define.amd ? define([ "require", "exports", "ometa-core", "@resin/sbvr-types", "lodash" ], factory) : "object" == typeof exports ? factory(require, exports, require("ometa-js").core) : factory(function(moduleName) {
        return root[moduleName];
    }, root, root.OMeta);
}(this, function(require, exports, OMeta) {
    var sbvrTypes = require("@resin/sbvr-types"), _ = require("lodash"), comparisons = {
        Equals: " = ",
        GreaterThan: " > ",
        GreaterThanOrEqual: " >= ",
        LessThan: " < ",
        LessThanOrEqual: " <= ",
        NotEquals: " != ",
        Like: " LIKE "
    }, fractionalSecondsFormat = function(date) {
        return this.Totalseconds(date) + " - " + this.Second(date);
    }, websqlBasicDateFormat = function(format) {
        return function(date) {
            return "STRFTIME('" + format + "', " + date + ")";
        };
    }, websqlDateFormats = {
        Year: websqlBasicDateFormat("%Y"),
        Month: websqlBasicDateFormat("%m"),
        Day: websqlBasicDateFormat("%d"),
        Hour: websqlBasicDateFormat("%H"),
        Minute: websqlBasicDateFormat("%M"),
        Second: websqlBasicDateFormat("%S"),
        Fractionalseconds: fractionalSecondsFormat,
        Totalseconds: websqlBasicDateFormat("%f")
    }, basicDateFormat = function(part) {
        return function(date) {
            return "EXTRACT('" + part + "' FROM " + date + ")";
        };
    }, dateFormats = {
        Year: basicDateFormat("YEAR"),
        Month: basicDateFormat("MONTH"),
        Day: basicDateFormat("DAY"),
        Hour: basicDateFormat("HOUR"),
        Minute: basicDateFormat("MINUTE"),
        Second: function(date) {
            return "FLOOR(" + dateFormats.Totalseconds(date) + ")";
        },
        Fractionalseconds: fractionalSecondsFormat,
        Totalseconds: basicDateFormat("SECOND")
    }, AbstractSQLRules2SQL = exports.AbstractSQLRules2SQL = OMeta._extend({
        NestedIndent: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return indent + "\t";
        },
        SelectQuery: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, fields, first, from, groupBy, limit, nestedIndent, offset, orderBy, rest, table, tables, where;
            nestedIndent = this._applyWithArgs("NestedIndent", indent);
            return this._or(function() {
                this._form(function() {
                    this._applyWithArgs("exactly", "UnionQuery");
                    first = this._applyWithArgs("SelectQuery", nestedIndent);
                    return rest = this._many1(function() {
                        return this._applyWithArgs("SelectQuery", nestedIndent);
                    });
                });
                return [ first ].concat(rest).join(indent + "UNION" + indent);
            }, function() {
                tables = [];
                where = "";
                groupBy = "";
                orderBy = "";
                limit = "";
                offset = "";
                this._form(function() {
                    this._applyWithArgs("exactly", "SelectQuery");
                    return this._many(function() {
                        return this._form(function() {
                            return this._or(function() {
                                return fields = this._applyWithArgs("Select", indent);
                            }, function() {
                                table = this._applyWithArgs("Table", indent);
                                return tables.push(table);
                            }, function() {
                                where = this._applyWithArgs("Where", indent);
                                return where = indent + where;
                            }, function() {
                                groupBy = this._applyWithArgs("GroupBy", indent);
                                return groupBy = indent + groupBy;
                            }, function() {
                                orderBy = this._applyWithArgs("OrderBy", indent);
                                return orderBy = indent + orderBy;
                            }, function() {
                                limit = this._applyWithArgs("Limit", indent);
                                return limit = indent + limit;
                            }, function() {
                                offset = this._applyWithArgs("Offset", indent);
                                return offset = indent + offset;
                            });
                        });
                    });
                });
                from = this._or(function() {
                    this._pred(tables.length);
                    return indent + "FROM " + tables.join("," + nestedIndent);
                }, function() {
                    return "";
                });
                return "SELECT " + fields.join(", ") + from + where + groupBy + orderBy + limit + offset;
            });
        },
        DeleteQuery: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, table, tables, where;
            tables = [];
            where = "";
            this._form(function() {
                this._applyWithArgs("exactly", "DeleteQuery");
                return this._many(function() {
                    return this._form(function() {
                        return this._or(function() {
                            table = this._applyWithArgs("Table", indent);
                            return tables.push(table);
                        }, function() {
                            where = this._applyWithArgs("Where", indent);
                            return where = indent + where;
                        });
                    });
                });
            });
            return "DELETE FROM " + tables.join(", ") + where;
        },
        UpsertQuery: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, insert, update;
            this._form(function() {
                this._applyWithArgs("exactly", "UpsertQuery");
                insert = this._applyWithArgs("InsertQuery", indent);
                insert = {
                    query: insert,
                    bindings: this.fieldOrderings
                };
                this.fieldOrderings = [];
                update = this._applyWithArgs("UpdateQuery", indent);
                return update = {
                    query: update,
                    bindings: this.fieldOrderings
                };
            });
            return [ insert, update ];
        },
        InsertQuery: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, insert;
            this._form(function() {
                this._applyWithArgs("exactly", "InsertQuery");
                return insert = this._applyWithArgs("InsertBody", indent);
            });
            return insert;
        },
        UpdateQuery: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, update;
            this._form(function() {
                this._applyWithArgs("exactly", "UpdateQuery");
                return update = this._applyWithArgs("UpdateBody", indent);
            });
            return update;
        },
        InsertBody: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, fields, table, tables, values;
            tables = [];
            this._many(function() {
                return this._form(function() {
                    return this._or(function() {
                        return fields = this._apply("Fields");
                    }, function() {
                        return values = this._applyWithArgs("Values", indent);
                    }, function() {
                        table = this._applyWithArgs("Table", indent);
                        return tables.push(table);
                    });
                });
            });
            return this._or(function() {
                this._pred(fields.length > 0);
                this._opt(function() {
                    this._pred(_.isArray(values));
                    return values = "VALUES (" + values.join(", ") + ")";
                });
                return "INSERT INTO " + tables.join(", ") + " (" + fields.join(", ") + ")" + indent + values;
            }, function() {
                return "INSERT INTO " + tables.join(", ") + " DEFAULT VALUES";
            });
        },
        UpdateBody: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, fields, nestedIndent, sets, table, tables, values, where;
            tables = [];
            where = "";
            this._many(function() {
                return this._form(function() {
                    return this._or(function() {
                        fields = this._apply("Fields");
                        return this._pred(fields.length > 0);
                    }, function() {
                        values = this._apply("Values");
                        return this._pred(values.length > 0);
                    }, function() {
                        table = this._applyWithArgs("Table", indent);
                        return tables.push(table);
                    }, function() {
                        where = this._applyWithArgs("Where", indent);
                        return where = indent + where;
                    });
                });
            });
            sets = [];
            (function() {
                for (var i = 0; i < fields.length; i++) sets[i] = fields[i] + " = " + values[i];
            }).call(this);
            nestedIndent = this._applyWithArgs("NestedIndent", indent);
            return "UPDATE " + tables.join(", ") + indent + "SET " + sets.join("," + nestedIndent) + where;
        },
        Fields: function() {
            var $elf = this, _fromIdx = this.input.idx, field, fields;
            this._applyWithArgs("exactly", "Fields");
            fields = [];
            this._form(function() {
                return fields = this._many(function() {
                    field = this.anything();
                    return '"' + field + '"';
                });
            });
            return fields;
        },
        Values: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, values;
            this._applyWithArgs("exactly", "Values");
            this._or(function() {
                return values = this._applyWithArgs("SelectQuery", indent);
            }, function() {
                return this._form(function() {
                    return values = this._many(function() {
                        return this._or(function() {
                            switch (this.anything()) {
                              case "?":
                                return "?";

                              default:
                                throw this._fail();
                            }
                        }, function() {
                            this._apply("true");
                            return 1;
                        }, function() {
                            this._apply("false");
                            return 0;
                        }, function() {
                            return this._apply("Null");
                        }, function() {
                            return this._apply("Bind");
                        }, function() {
                            return this._apply("Default");
                        }, function() {
                            return this._apply("Text");
                        }, function() {
                            return this._apply("Number");
                        });
                    });
                });
            });
            return values;
        },
        Default: function() {
            var $elf = this, _fromIdx = this.input.idx;
            this._applyWithArgs("exactly", "Default");
            return "DEFAULT";
        },
        Select: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, as, field, fields, table, value;
            this._applyWithArgs("exactly", "Select");
            this._form(function() {
                return this._or(function() {
                    this._apply("end");
                    return fields = [ "1" ];
                }, function() {
                    return fields = this._many(function() {
                        return this._or(function() {
                            this._form(function() {
                                return field = this._or(function() {
                                    field = this._applyWithArgs("SelectField", indent);
                                    as = this.anything();
                                    return field + ' AS "' + as + '"';
                                }, function() {
                                    switch (this.anything()) {
                                      case "Count":
                                        this._applyWithArgs("exactly", "*");
                                        return "COUNT(*)";

                                      default:
                                        throw this._fail();
                                    }
                                }, function() {
                                    table = this.anything();
                                    this._applyWithArgs("exactly", "*");
                                    return '"' + table + '".*';
                                }, function() {
                                    value = this._applyWithArgs("AnyValue", indent);
                                    as = this.anything();
                                    return value + ' AS "' + as + '"';
                                });
                            });
                            return field;
                        }, function() {
                            return this._applyWithArgs("AnyValue", indent);
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
            return fields;
        },
        SelectField: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("Count");
            }, function() {
                return this._applyWithArgs("AnyValue", indent);
            }, function() {
                return this._apply("Null");
            });
        },
        Count: function() {
            var $elf = this, _fromIdx = this.input.idx;
            this._form(function() {
                this._applyWithArgs("exactly", "Count");
                return this._applyWithArgs("exactly", "*");
            });
            return "COUNT(*)";
        },
        Table: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, alias, from, nestedindent, query, table;
            this._applyWithArgs("exactly", "From");
            nestedindent = this._applyWithArgs("NestedIndent", indent);
            return this._or(function() {
                this._not(function() {
                    return this._apply("string");
                });
                this._form(function() {
                    from = this._or(function() {
                        query = this._applyWithArgs("SelectQuery", nestedindent);
                        return "(" + nestedindent + query + indent + ")";
                    }, function() {
                        table = this.anything();
                        return this._or(function() {
                            this._pred(!_.isNull(this.namespace));
                            return '"' + this.namespace + '"."' + table + '"';
                        }, function() {
                            return '"' + table + '"';
                        });
                    });
                    return alias = this.anything();
                });
                return from + ' AS "' + alias + '"';
            }, function() {
                query = this._applyWithArgs("SelectQuery", nestedindent);
                return "(" + nestedindent + query + indent + ")";
            }, function() {
                table = this.anything();
                return this._or(function() {
                    this._pred(!_.isNull(this.namespace));
                    return '"' + this.namespace + '"."' + table + '"';
                }, function() {
                    return '"' + table + '"';
                });
            });
        },
        Where: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, ruleBody;
            this._applyWithArgs("exactly", "Where");
            ruleBody = this._applyWithArgs("BooleanValue", indent);
            return "WHERE " + ruleBody;
        },
        GroupBy: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, values;
            this._applyWithArgs("exactly", "GroupBy");
            this._form(function() {
                return values = this._many1(function() {
                    return this._applyWithArgs("AnyValue", indent);
                });
            });
            return "GROUP BY " + values.join(", ");
        },
        OrderBy: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, field, nestedIndent, order, orders;
            this._applyWithArgs("exactly", "OrderBy");
            orders = this._many1(function() {
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
                    return field = this._apply("Field");
                });
                return field + " " + order;
            });
            nestedIndent = this._applyWithArgs("NestedIndent", indent);
            return "ORDER BY " + orders.join("," + nestedIndent);
        },
        Limit: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._applyWithArgs("exactly", "Limit");
            num = this._applyWithArgs("NumericValue", indent);
            return "LIMIT " + num;
        },
        Offset: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._applyWithArgs("exactly", "Offset");
            num = this._applyWithArgs("NumericValue", indent);
            return "OFFSET " + num;
        },
        AnyValue: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("UnknownValue", indent);
            }, function() {
                return this._applyWithArgs("TextValue", indent);
            }, function() {
                return this._applyWithArgs("NumericValue", indent);
            }, function() {
                return this._applyWithArgs("BooleanValue", indent);
            }, function() {
                return this._applyWithArgs("DateValue", indent);
            }, function() {
                return this._applyWithArgs("JSONValue", indent);
            }, function() {
                return this._applyWithArgs("DurationValue", indent);
            });
        },
        UnknownValue: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, nestedIndent, query;
            return this._or(function() {
                return this._apply("Field");
            }, function() {
                return this._apply("Bind");
            }, function() {
                return this._apply("Null");
            }, function() {
                return this._applyWithArgs("Cast", indent);
            }, function() {
                nestedIndent = this._applyWithArgs("NestedIndent", indent);
                query = this._applyWithArgs("SelectQuery", nestedIndent);
                return "(" + nestedIndent + query + indent + ")";
            });
        },
        Field: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("ReferencedField");
            }, function() {
                return this._apply("UnreferencedField");
            });
        },
        UnreferencedField: function() {
            var $elf = this, _fromIdx = this.input.idx, field;
            this._form(function() {
                this._applyWithArgs("exactly", "Field");
                return field = this.anything();
            });
            return '"' + field + '"';
        },
        ReferencedField: function() {
            var $elf = this, _fromIdx = this.input.idx, field, table;
            this._form(function() {
                this._applyWithArgs("exactly", "ReferencedField");
                table = this.anything();
                return field = this.anything();
            });
            return '"' + table + '"."' + field + '"';
        },
        Bind: function() {
            var $elf = this, _fromIdx = this.input.idx, bind, field, tableName;
            this._form(function() {
                this._applyWithArgs("exactly", "Bind");
                return bind = this._or(function() {
                    return this._apply("number");
                }, function() {
                    tableName = this.anything();
                    field = this.anything();
                    return [ tableName, field ];
                });
            });
            this.fieldOrderings.push([ "Bind", bind ]);
            return "?";
        },
        Null: function() {
            var $elf = this, _fromIdx = this.input.idx, next;
            next = this.anything();
            this._pred(null === next);
            return "NULL";
        },
        Cast: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, type, v;
            this._form(function() {
                this._applyWithArgs("exactly", "Cast");
                v = this._applyWithArgs("AnyValue", indent);
                return type = this._apply("DataType");
            });
            return "CAST(" + v + " AS " + type + ")";
        },
        DataType: function() {
            var $elf = this, _fromIdx = this.input.idx, dbType, typeName;
            typeName = this.anything();
            this._pred(sbvrTypes[typeName]);
            this._pred(sbvrTypes[typeName].types[this.engine]);
            dbType = sbvrTypes[typeName].types[this.engine];
            return this._or(function() {
                this._pred(_.isFunction(dbType) || "SERIAL" === dbType.toUpperCase());
                return "INTEGER";
            }, function() {
                return dbType;
            });
        },
        TextValue: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("UnknownValue", indent);
            }, function() {
                return this._apply("Text");
            }, function() {
                return this._applyWithArgs("Concat", indent);
            }, function() {
                return this._applyWithArgs("Lower", indent);
            }, function() {
                return this._applyWithArgs("Upper", indent);
            }, function() {
                return this._applyWithArgs("Trim", indent);
            }, function() {
                return this._applyWithArgs("Replace", indent);
            }, function() {
                return this._applyWithArgs("Substring", indent);
            }, function() {
                return this._applyWithArgs("Right", indent);
            });
        },
        Text: function() {
            var $elf = this, _fromIdx = this.input.idx, text;
            this._form(function() {
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
            this.fieldOrderings.push([ "Text", text ]);
            return "?";
        },
        Concat: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, comparators;
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
                return comparators = this._many1(function() {
                    return this._applyWithArgs("TextValue", indent);
                });
            });
            return this._or(function() {
                this._pred("mysql" == this.engine);
                return "CONCAT(" + comparators.join(", ") + ")";
            }, function() {
                return "(" + comparators.join(" || ") + ")";
            });
        },
        Lower: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, string;
            this._form(function() {
                this._applyWithArgs("exactly", "Lower");
                return string = this._applyWithArgs("TextValue", indent);
            });
            return "LOWER(" + string + ")";
        },
        Upper: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, string;
            this._form(function() {
                this._applyWithArgs("exactly", "Upper");
                return string = this._applyWithArgs("TextValue", indent);
            });
            return "UPPER(" + string + ")";
        },
        Trim: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, string;
            this._form(function() {
                this._applyWithArgs("exactly", "Trim");
                return string = this._applyWithArgs("TextValue", indent);
            });
            return "TRIM(" + string + ")";
        },
        Replace: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, find, replacement, string;
            this._form(function() {
                this._applyWithArgs("exactly", "Replace");
                string = this._applyWithArgs("TextValue", indent);
                find = this._applyWithArgs("TextValue", indent);
                return replacement = this._applyWithArgs("TextValue", indent);
            });
            return "REPLACE(" + string + ", " + find + ", " + replacement + ")";
        },
        Substring: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, args, string;
            this._form(function() {
                this._applyWithArgs("exactly", "Substring");
                string = this._apply("TextValue");
                return args = this._many1(function() {
                    return this._apply("NumericValue");
                });
            });
            return "SUBSTRING(" + [ string ].concat(args).join(", ") + ")";
        },
        Right: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, n, string;
            this._form(function() {
                this._applyWithArgs("exactly", "Right");
                string = this._apply("TextValue");
                return n = this._apply("NumericValue");
            });
            return this._or(function() {
                this._pred("websql" == this.engine);
                return "SUBSTRING(" + string + ", -" + n + ")";
            }, function() {
                return "RIGHT(" + string + ", " + n + ")";
            });
        },
        NumericValue: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("UnknownValue", indent);
            }, function() {
                return this._apply("Number");
            }, function() {
                return this._applyWithArgs("MathOp", indent);
            }, function() {
                return this._applyWithArgs("BitwiseAnd", indent);
            }, function() {
                return this._applyWithArgs("BitwiseShiftRight", indent);
            }, function() {
                return this._applyWithArgs("CharacterLength", indent);
            }, function() {
                return this._applyWithArgs("StrPos", indent);
            }, function() {
                return this._applyWithArgs("ExtractNumericDatePart", indent);
            }, function() {
                return this._applyWithArgs("TotalSeconds", indent);
            }, function() {
                return this._applyWithArgs("Round", indent);
            }, function() {
                return this._applyWithArgs("Floor", indent);
            }, function() {
                return this._applyWithArgs("Ceiling", indent);
            });
        },
        Number: function() {
            var $elf = this, _fromIdx = this.input.idx, number;
            this._form(function() {
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
                return number = this._apply("number");
            });
            return number;
        },
        MathOp: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, lhs, op, rhs;
            this._form(function() {
                op = function() {
                    switch (this.anything()) {
                      case "Add":
                        return "+";

                      case "Divide":
                        return "/";

                      case "Multiply":
                        return "*";

                      case "Subtract":
                        return "-";

                      default:
                        throw this._fail();
                    }
                }.call(this);
                lhs = this._applyWithArgs("NumericValue", indent);
                return rhs = this._applyWithArgs("NumericValue", indent);
            });
            return [ lhs, op, rhs ].join(" ");
        },
        BitwiseAnd: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, mask, operand;
            this._form(function() {
                this._applyWithArgs("exactly", "BitwiseAnd");
                operand = this._applyWithArgs("NumericValue", indent);
                return mask = this._applyWithArgs("NumericValue", indent);
            });
            return "(" + operand + " & " + mask + ")";
        },
        BitwiseShiftRight: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, operand, shift;
            this._form(function() {
                this._applyWithArgs("exactly", "BitwiseShiftRight");
                operand = this._applyWithArgs("NumericValue", indent);
                return shift = this._applyWithArgs("NumericValue", indent);
            });
            return "(" + operand + " >> " + shift + ")";
        },
        CharacterLength: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, text;
            this._form(function() {
                this._applyWithArgs("exactly", "CharacterLength");
                return text = this._applyWithArgs("TextValue", indent);
            });
            return this._or(function() {
                this._pred("mysql" == this.engine);
                return "CHAR_LENGTH(" + text + ")";
            }, function() {
                return "LENGTH(" + text + ")";
            });
        },
        StrPos: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, haystack, needle;
            this._form(function() {
                this._applyWithArgs("exactly", "StrPos");
                haystack = this._apply("TextValue");
                return needle = this._apply("TextValue");
            });
            return this._or(function() {
                this._pred("postgres" == this.engine);
                return "STRPOS(" + haystack + ", " + needle + ")";
            }, function() {
                return "INSTR(" + haystack + ", " + needle + ")";
            });
        },
        ExtractNumericDatePart: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, date, part;
            this._form(function() {
                part = function() {
                    switch (this.anything()) {
                      case "Day":
                        return "Day";

                      case "Fractionalseconds":
                        return "Fractionalseconds";

                      case "Hour":
                        return "Hour";

                      case "Minute":
                        return "Minute";

                      case "Month":
                        return "Month";

                      case "Second":
                        return "Second";

                      case "Year":
                        return "Year";

                      default:
                        throw this._fail();
                    }
                }.call(this);
                return date = this._apply("DateValue");
            });
            return this._or(function() {
                this._pred("websql" == this.engine);
                return websqlDateFormats[part](date);
            }, function() {
                return dateFormats[part](date);
            });
        },
        TotalSeconds: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, duration;
            this._form(function() {
                this._applyWithArgs("exactly", "Totalseconds");
                return duration = this._applyWithArgs("DurationValue", indent);
            });
            return this._or(function() {
                this._pred("postgres" == this.engine);
                return "EXTRACT(EPOCH FROM " + duration + ")";
            }, function() {
                this._pred("mysql" == this.engine);
                return "(TIMESTAMPDIFF(MICROSECOND, FROM_UNIXTIME(0), FROM_UNIXTIME(0) + " + duration + ") / 1000000)";
            }, function() {
                return function() {
                    throw new Error("TotalSeconds not supported on: " + this.engine);
                }.call(this);
            });
        },
        Round: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._form(function() {
                this._applyWithArgs("exactly", "Round");
                return num = this._apply("NumericValue");
            });
            return "ROUND(" + num + ")";
        },
        Floor: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._form(function() {
                this._applyWithArgs("exactly", "Floor");
                return num = this._apply("NumericValue");
            });
            return "FLOOR(" + num + ")";
        },
        Ceiling: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, num;
            this._form(function() {
                this._applyWithArgs("exactly", "Ceiling");
                return num = this._apply("NumericValue");
            });
            return "CEILING(" + num + ")";
        },
        BooleanValue: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("UnknownValue", indent);
            }, function() {
                return this._apply("Boolean");
            }, function() {
                return this._applyWithArgs("And", indent);
            }, function() {
                return this._applyWithArgs("Not", indent);
            }, function() {
                return this._applyWithArgs("Or", indent);
            }, function() {
                return this._applyWithArgs("Exists", indent);
            }, function() {
                return this._applyWithArgs("NotExists", indent);
            }, function() {
                return this._applyWithArgs("Comparison", indent);
            }, function() {
                return this._applyWithArgs("Between", indent);
            }, function() {
                return this._applyWithArgs("In", indent);
            }, function() {
                return this._applyWithArgs("NotIn", indent);
            });
        },
        Boolean: function() {
            var $elf = this, _fromIdx = this.input.idx, bool;
            this._form(function() {
                this._applyWithArgs("exactly", "Boolean");
                return bool = this._or(function() {
                    this._apply("true");
                    return 1;
                }, function() {
                    this._apply("false");
                    return 0;
                });
            });
            return bool;
        },
        Not: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, bool, nestedIndent;
            this._form(function() {
                this._applyWithArgs("exactly", "Not");
                nestedIndent = this._applyWithArgs("NestedIndent", indent);
                return bool = this._applyWithArgs("BooleanValue", nestedIndent);
            });
            return "NOT (" + nestedIndent + bool + indent + ")";
        },
        And: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, bools;
            this._form(function() {
                this._applyWithArgs("exactly", "And");
                return bools = this._many(function() {
                    return this._applyWithArgs("BooleanValue", indent);
                });
            });
            return bools.join(indent + "AND ");
        },
        Or: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, bools;
            this._form(function() {
                this._applyWithArgs("exactly", "Or");
                return bools = this._many(function() {
                    return this._applyWithArgs("BooleanValue", indent);
                });
            });
            return "(" + bools.join(indent + "OR ") + ")";
        },
        Exists: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, comparator, exists, nestedIndent, ruleBody;
            this._form(function() {
                this._applyWithArgs("exactly", "Exists");
                return exists = this._or(function() {
                    nestedIndent = this._applyWithArgs("NestedIndent", indent);
                    ruleBody = this._applyWithArgs("SelectQuery", nestedIndent);
                    return "EXISTS (" + nestedIndent + ruleBody + indent + ")";
                }, function() {
                    comparator = this._applyWithArgs("AnyValue", indent);
                    return comparator + " IS NOT NULL";
                });
            });
            return exists;
        },
        NotExists: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, comparator, exists, nestedIndent, ruleBody;
            this._form(function() {
                this._applyWithArgs("exactly", "NotExists");
                return exists = this._or(function() {
                    nestedIndent = this._applyWithArgs("NestedIndent", indent);
                    ruleBody = this._applyWithArgs("SelectQuery", nestedIndent);
                    return "NOT EXISTS (" + nestedIndent + ruleBody + indent + ")";
                }, function() {
                    comparator = this._applyWithArgs("AnyValue", indent);
                    return comparator + " IS NULL";
                });
            });
            return exists;
        },
        Comparison: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, a, b, comparison;
            this._form(function() {
                comparison = function() {
                    switch (this.anything()) {
                      case "Equals":
                        return "Equals";

                      case "GreaterThan":
                        return "GreaterThan";

                      case "GreaterThanOrEqual":
                        return "GreaterThanOrEqual";

                      case "LessThan":
                        return "LessThan";

                      case "LessThanOrEqual":
                        return "LessThanOrEqual";

                      case "Like":
                        return "Like";

                      case "NotEquals":
                        return "NotEquals";

                      default:
                        throw this._fail();
                    }
                }.call(this);
                a = this._applyWithArgs("AnyValue", indent);
                return b = this._applyWithArgs("AnyValue", indent);
            });
            return a + comparisons[comparison] + b;
        },
        Between: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, a, b, val;
            this._form(function() {
                this._applyWithArgs("exactly", "Between");
                val = this._applyWithArgs("AnyValue", indent);
                a = this._applyWithArgs("AnyValue", indent);
                return b = this._applyWithArgs("AnyValue", indent);
            });
            return val + " BETWEEN " + a + " AND " + b;
        },
        In: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, field, vals;
            this._form(function() {
                this._applyWithArgs("exactly", "In");
                field = this._apply("Field");
                return vals = this._many1(function() {
                    return this._applyWithArgs("AnyValue", indent);
                });
            });
            return field + " IN (" + vals.join(", ") + ")";
        },
        NotIn: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, field, vals;
            this._form(function() {
                this._applyWithArgs("exactly", "NotIn");
                field = this._apply("Field");
                return vals = this._many1(function() {
                    return this._applyWithArgs("AnyValue", indent);
                });
            });
            return field + " NOT IN (" + vals.join(", ") + ")";
        },
        DateValue: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("UnknownValue", indent);
            }, function() {
                return this._applyWithArgs("Date", indent);
            }, function() {
                return this._applyWithArgs("ToDate", indent);
            }, function() {
                return this._applyWithArgs("ToTime", indent);
            }, function() {
                return this._applyWithArgs("Now", indent);
            });
        },
        Date: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, date;
            this._form(function() {
                this._applyWithArgs("exactly", "Date");
                return date = this.anything();
            });
            this.fieldOrderings.push([ "Date", date ]);
            return "?";
        },
        ToDate: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, date;
            this._form(function() {
                this._applyWithArgs("exactly", "ToDate");
                return date = this._apply("DateValue");
            });
            return "DATE(" + date + ")";
        },
        ToTime: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, date;
            this._form(function() {
                this._applyWithArgs("exactly", "ToTime");
                return date = this._apply("DateValue");
            });
            return this._or(function() {
                this._pred("postgres" == this.engine);
                return "CAST(" + date + " AS TIME)";
            }, function() {
                return "TIME(" + date + ")";
            });
        },
        Now: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            this._form(function() {
                return this._applyWithArgs("exactly", "Now");
            });
            return "CURRENT_TIMESTAMP";
        },
        JSONValue: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("UnknownValue", indent);
            }, function() {
                return this._applyWithArgs("AggregateJSON", indent);
            });
        },
        AggregateJSON: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, field, table;
            this._form(function() {
                this._applyWithArgs("exactly", "AggregateJSON");
                return this._form(function() {
                    table = this.anything();
                    return field = this._or(function() {
                        switch (this.anything()) {
                          case "*":
                            return "*";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        field = this.anything();
                        return '"' + field + '"';
                    });
                });
            });
            field = '"' + table + '".' + field;
            return this._or(function() {
                this._pred("postgres" == this.engine);
                return "coalesce(array_to_json(array_agg(" + field + ")), '[]')";
            }, function() {
                return function() {
                    throw new Error("AggregateJSON not supported on: " + this.engine);
                }.call(this);
            });
        },
        DurationValue: function(indent) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("UnknownValue", indent);
            }, function() {
                return this._applyWithArgs("Duration", indent);
            });
        },
        Duration: function(indent) {
            var $elf = this, _fromIdx = this.input.idx, duration;
            this._form(function() {
                this._applyWithArgs("exactly", "Duration");
                return duration = this.anything();
            });
            this._pred(_.isObject(duration));
            duration = _(duration).pick("negative", "day", "hour", "minute", "second").omitBy(_.isNil).value();
            this._pred(!_(duration).omit("negative").isEmpty());
            return this._or(function() {
                this._pred("websql" == this.engine);
                return function() {
                    throw new Error("Durations not supported on: " + this.engine);
                }.call(this);
            }, function() {
                return "INTERVAL '" + (duration.negative ? "-" : "") + (duration.day || "0") + " " + (duration.negative ? "-" : "") + (duration.hour || "0") + ":" + (duration.minute || "0") + ":" + Number(duration.second).toLocaleString("en", {
                    minimumFractionDigits: 1
                }) + "'" + ("mysql" == this.engine ? " DAY_MICROSECOND" : "");
            });
        },
        Process: function(namespace) {
            var $elf = this, _fromIdx = this.input.idx, query, value;
            return this._or(function() {
                this.fieldOrderings = [];
                this.namespace = namespace || null;
                query = this._or(function() {
                    return this._applyWithArgs("SelectQuery", "\n");
                }, function() {
                    return this._applyWithArgs("InsertQuery", "\n");
                }, function() {
                    return this._applyWithArgs("UpdateQuery", "\n");
                }, function() {
                    return this._applyWithArgs("DeleteQuery", "\n");
                });
                return {
                    query: query,
                    bindings: this.fieldOrderings
                };
            }, function() {
                return this._applyWithArgs("UpsertQuery", "\n");
            }, function() {
                value = this._applyWithArgs("AnyValue", "\n");
                return {
                    query: "SELECT " + value + ' AS "result";',
                    bindings: this.fieldOrderings
                };
            });
        }
    });
});