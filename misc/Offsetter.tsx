import React, { useState } from "react";
import Web3 from "web3";
// import { Field, Form } from "react-final-form";

import "./Offsetter.scss";
// import OFFSET_HELPER_ABI from "../contracts/OffsetHelper2.json";

const OFFSET_HELPER_ABI = require("../contracts/OffsetHelper2.json");

const Offsetter = () => {
    const web3 = new Web3(window.ethereum);
    const contract = new web3.eth.Contract(OFFSET_HELPER_ABI, "0x79E63048B355F4FBa192c5b28687B852a5521b31");
    const [amountTco2, setAmountTco2] = useState("0.1");
    const [amountTco2BigNumber, setAmountTco2BigNumber] = useState(web3.utils.toWei("0.1", "ether"));
    const [costMatic, setCostMatic] = useState("");
    // const { active, library, account, chainId } = useWeb3React();

    const onChangeAmountTco2 = async (ev: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        try {
            console.log(ev);
            console.log(ev.target.value);
            const newAmountTco2BigNumber = web3.utils.toWei(ev.target.value, "ether");
            if (amountTco2BigNumber === "0") {
                console.log("ooop");
                return;
            }
            if (newAmountTco2BigNumber === amountTco2BigNumber) {
                console.log("same val");
                return;
            }
            setAmountTco2(ev.target.value);
            setAmountTco2BigNumber(newAmountTco2BigNumber);
            console.log(amountTco2, amountTco2BigNumber);
            console.log(ev.target.value, newAmountTco2BigNumber);

            const x = await contract.methods
                .howMuchETHShouldISendToSwap("0xD838290e877E0188a4A44700463419ED96c16107", newAmountTco2BigNumber)
                .call();
            setCostMatic(web3.utils.fromWei(x, "ether"));
        } catch (e) {
            console.log(e);
        }
    };

    return (
        <div className="wrap-flex">
            <p>Offsetting</p>
            <input type="text" name="amountTco2" value={amountTco2} onChange={onChangeAmountTco2} />
            <p>TCO2</p>
            <p>will cost:</p>
            <input type="text" name="costMatic" value={costMatic} background-color="#a5a5a5" readOnly />
            <p>MATIC</p>
            <button type="button">Offset!</button>
        </div>
    );
};

export default Offsetter;
