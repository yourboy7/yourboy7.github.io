let APP_ID = "3ccd2d178831487da40df7c3888bffe3";

let uid = String(Math.floor(Math.random() * 10000));
let token;

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if(!roomId){
    window.location = 'lobby.html';
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ["stun:stun1.l.google.com:19302","stun:stun2.l.google.com:19302"]
        }
    ]
}

let constraints = {
    video:{
        width: {min:640,ideal:1920,max:1920},
        height: {min:480,ideal:1080,max:1080},
    },
    audio:true
}

let init=async()=>{
    await initToken(uid);
    
    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({uid,token});

    //index.html?room=234234
    //channel = client.createChannel(roomID);
    channel = client.createChannel(roomId);
    await channel.join();

    channel.on("MemberJoined",handleUserJoined);
    channel.on("MemberLeft",handleUserLeft);

    client.on("MessageFromPeer",handleMessageFromPeer);

    localStream=await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user-1').srcObject=localStream;

}

let handleUserJoined = async (MemberId) => {
    console.log("A new user joined the channel:",MemberId);
    createOffer(MemberId);
}

let handleUserLeft = async (MemberId) => {
    document.getElementById('user-2').style.display="none";
    document.getElementById('user-1').classList.remove("smallFrame");
}

let handleMessageFromPeer = async (message,MemberId) => {
    message = JSON.parse(message.text);
    console.log("Message:",message);

    if(message.type === "offer"){
        createAnswer(MemberId,message.offer);
    }
    
    if(message.type === "answer"){
        addAnswer(message.answer);
    }

    if(message.type === "candidate"){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}

let createPeerConnection=async(MemberId)=>{
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject=remoteStream;
    document.getElementById('user-2').style.display="block";
    document.getElementById('user-1').classList.add("smallFrame");

    if(!localStream){
        localStream=await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('user-1').srcObject=localStream;
    }

    /*
    在 WebRTC 中，MediaStream 表示一个包含一个或多个
    MediaStreamTrack 的数据流。MediaStreamTrack 是表示单个媒体轨道的接口，
    例如音频轨道或视频轨道。
    */
    //使用 peerConnection.addTrack() 方法将MediaStreamTrack添加到 peerConnection 中，以便进行传输
    //localStream->peerConnection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    //接收远程流.当远程流传输到本地时，peerConnection 会触发 ontrack 事件
    //peerConnection->remoteStream
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate','candidate':event.candidate})},MemberId);
        }
    }
}

let createOffer=async(MemberId)=>{
    await createPeerConnection(MemberId);

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    //client.sendMessageToPeer({text:uid+" say Hey "+MemberId+"!!!"},MemberId);
    client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId);
}

let createAnswer=async(MemberId,offer)=>{
    await createPeerConnection(MemberId);

    await peerConnection.setRemoteDescription(offer);

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer','answer':answer})},MemberId);
}

let addAnswer=async(answer)=>{
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer);
    }
}

let leaveChannel=async()=>{
    await channel.leave();
    await client.logout();
}

let toggleCamera=async()=>{
    let videoTrack = localStream.getTracks().find(track => track.kind === "video");
    
    if(videoTrack.enabled){
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = "rgb(255, 80, 80)";
    }else{
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = "rgb(179, 102, 249, .9)";
    }
}

let toggleMic=async()=>{
    let audioTrack = localStream.getTracks().find(track => track.kind === "audio");
    
    if(audioTrack.enabled){
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = "rgb(255, 80, 80)";
    }else{
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = "rgb(179, 102, 249, .9)";
    }
}

window.addEventListener("beforeunload",leaveChannel);

document.getElementById('camera-btn').addEventListener('click',toggleCamera);
document.getElementById('mic-btn').addEventListener('click',toggleMic);

let initToken= async(uid) => commonAjaxGet(false,"https://yourboy7.fun:4567/rtmToken?account="+uid,{},(response)=>token=response.key,(error)=>console.error("Error", error))

/**
 * 封装公共ajax,get的传输方式，必传参数
 * @param async    是否同步异步
 * @param url       请求地址
 * @param data      传输数据
 * @param success     成功之后的回调函数
 */
function commonAjaxGet(async, url, data, success, err) {
    $.ajax({
        "async": async,
        "url": url,
        "type": "GET",
        "data": data,
        "dataType": "json",
        success: success || function (data) {
            // //console.log(data)
        },
        error: err || function (jqXHR, textStatus, errorThrown) {
            // alert(jqXHR);
            //  //console.log(jqXHR);
        },
    });
}

init();
