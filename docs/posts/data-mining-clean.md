---
title: 数据挖掘第一步：把数据清洗讲清楚
date: '2026-09-08'
description: 用 pandas 处理缺失值、重复值、异常值和类型转换，给后续建模打好基础。
tags: [数据挖掘, Python, 学习]
readingTime: 6
---

# 数据挖掘第一步：把数据清洗讲清楚

数据清洗不是“把数据变好看”，而是保证后续分析建立在可信的数据上。本文用 pandas 梳理一套最常见的清洗流程。

## 1. 先看数据全貌

```python
import pandas as pd

df = pd.read_csv('data.csv')

print(df.shape)
print(df.head())
print(df.info())
print(df.describe(include='all'))
```

重点看：

- 每列的数据类型是否正确；
- 缺失值多不多；
- 数值列的范围是否异常；
- 类别列有多少种取值。

## 2. 处理缺失值

先统计：

```python
missing = df.isnull().sum().sort_values(ascending=False)
print(missing[missing > 0])
```

处理方式取决于缺失比例和业务含义：

```python
# 数值列用中位数填充，比均值更抗异常值
df['age'] = df['age'].fillna(df['age'].median())

# 类别列用众数填充
df['city'] = df['city'].fillna(df['city'].mode()[0])

# 缺失比例过高的列考虑直接删除
df = df.drop(columns=['unused_column'])
```

如果缺失本身有信息，也可以单独加一列标记：

```python
df['age_missing'] = df['age'].isnull().astype(int)
```

## 3. 处理重复值

```python
print(df.duplicated().sum())

df = df.drop_duplicates()

# 按业务主键去重，保留最新记录
df = df.sort_values('updated_at').drop_duplicates(subset=['user_id'], keep='last')
```

不要无脑 `drop_duplicates()`，要先确认“重复”的定义是不是业务上的同一实体。

## 4. 处理异常值

用 IQR 方法是常见做法：

```python
q1 = df['amount'].quantile(0.25)
q3 = df['amount'].quantile(0.75)
iqr = q3 - q1
lower = q1 - 1.5 * iqr
upper = q3 + 1.5 * iqr

outliers = df[(df['amount'] < lower) | (df['amount'] > upper)]
print(outliers[['amount']].head())
```

异常值不一定要删。先判断是录入错误、单位问题，还是真实存在的极端业务。可以：

- 修正明显的录入错误；
- 对偏态分布做对数变换；
- 保留但使用对异常值更稳健的模型。

## 5. 类型转换

```python
df['date'] = pd.to_datetime(df['date'], errors='coerce')
df['category'] = df['category'].astype('category')
df['is_active'] = df['is_active'].map({'Y': 1, 'N': 0})
```

日期和类别类型转换后，后续筛选、分组和建模都会方便很多。

## 6. 保存清洗结果

```python
df.to_csv('data_clean.csv', index=False)
```

同时建议在脚本开头固定随机种子，保证结果可复现：

```python
import numpy as np
np.random.seed(42)
```

## 小结

清洗流程可以固定成：看全貌 → 缺失值 → 重复值 → 异常值 → 类型转换 → 保存。每一步都写清处理理由，后续建模时才不会出现“结果不可解释”的问题。
